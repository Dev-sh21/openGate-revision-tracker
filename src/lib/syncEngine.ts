import { prisma } from './db';
import { getGoogleClient } from './googleClient';
import { getNotionClient } from './notionClient';
import { google } from 'googleapis';
import { Client } from '@notionhq/client';

// ==========================================
// GOOGLE CALENDAR INTEGRATION
// ==========================================

export async function syncTopicToGoogleCalendar(userId: string, topicId: string) {
  try {
    const oauth2Client = await getGoogleClient(userId);
    if (!oauth2Client) return;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { timezone: true, reminderOffsetMinutes: true },
    });
    const timezone = user?.timezone || 'UTC';
    const reminderOffset = user?.reminderOffsetMinutes ?? 0;

    const topic = await prisma.topic.findUnique({
      where: { id: topicId },
      include: {
        subject: true,
        revisions: {
          orderBy: { revisionNumber: 'asc' },
        },
      },
    });

    if (!topic) return;

    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

    // Try to get or create a "Revision Tracker" secondary calendar
    let calendarId = 'primary'; // Fallback to primary
    try {
      const calendarList = await calendar.calendarList.list();
      const existingCal = calendarList.data.items?.find(
        (c) => c.summary === 'Revision Tracker'
      );
      if (existingCal) {
        calendarId = existingCal.id!;
      } else {
        const newCal = await calendar.calendars.insert({
          requestBody: {
            summary: 'Revision Tracker',
            timeZone: timezone,
          },
        });
        calendarId = newCal.data.id!;
      }
    } catch (e) {
      console.error('Failed to list/create Revision Tracker calendar, using primary:', e);
    }

    for (const rev of topic.revisions) {
      const startDateTime = new Date(rev.scheduledDate);
      startDateTime.setHours(9, 0, 0, 0); // 9:00 AM
      const endDateTime = new Date(rev.scheduledDate);
      endDateTime.setHours(9, 30, 0, 0); // 9:30 AM

      // Detailed event title based on status
      let prefix = `[Rev ${rev.revisionNumber}]`;
      if (rev.status === 'COMPLETED') prefix = `[DONE] ${prefix}`;
      if (rev.status === 'SKIPPED') prefix = `[SKIP] ${prefix}`;
      if (rev.status === 'OVERDUE') prefix = `[DUE] ${prefix}`;

      const eventBody: any = {
        summary: `${prefix} ${topic.name} (${topic.subject.name})`,
        description: `Spaced repetition study session.\nTopic: ${topic.name}\nSubject: ${topic.subject.name}\nRevision Stage: ${rev.revisionNumber} of 4.\nStatus: ${rev.status}`,
        start: {
          dateTime: startDateTime.toISOString(),
          timeZone: timezone,
        },
        end: {
          dateTime: endDateTime.toISOString(),
          timeZone: timezone,
        },
        reminders: {
          useDefault: false,
          overrides: [
            { method: 'popup', minutes: reminderOffset },
            { method: 'email', minutes: reminderOffset },
          ],
        },
      };

      if (rev.googleEventId) {
        try {
          await calendar.events.patch({
            calendarId,
            eventId: rev.googleEventId,
            requestBody: eventBody,
          });
        } catch (err: any) {
          if (err.status === 404) {
            // Event was deleted in Calendar, recreate it
            const newEvent = await calendar.events.insert({
              calendarId,
              requestBody: eventBody,
            });
            await prisma.revisionSchedule.update({
              where: { id: rev.id },
              data: { googleEventId: newEvent.data.id },
            });
          } else {
            console.error(`Failed to patch calendar event for rev ${rev.id}:`, err);
          }
        }
      } else {
        const newEvent = await calendar.events.insert({
          calendarId,
          requestBody: eventBody,
        });
        await prisma.revisionSchedule.update({
          where: { id: rev.id },
          data: { googleEventId: newEvent.data.id },
        });
      }
    }
  } catch (error) {
    console.error(`Error in syncTopicToGoogleCalendar for topic ${topicId}:`, error);
  }
}

// ==========================================
// GOOGLE SHEETS INTEGRATION
// ==========================================

export async function getOrCreateSpreadsheet(userId: string) {
  const oauth2Client = await getGoogleClient(userId);
  if (!oauth2Client) return null;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { googleSheetsId: true },
  });

  const sheets = google.sheets({ version: 'v4', auth: oauth2Client });
  const drive = google.drive({ version: 'v3', auth: oauth2Client });

  if (user?.googleSheetsId) {
    // Verify spreadsheet still exists
    try {
      await sheets.spreadsheets.get({ spreadsheetId: user.googleSheetsId });
      return user.googleSheetsId;
    } catch (e) {
      console.warn('Sheets ID found in DB is invalid/deleted, creating a new one.');
    }
  }

  // Create new spreadsheet
  try {
    const response = await sheets.spreadsheets.create({
      requestBody: {
        properties: {
          title: 'Revision Tracker Sync',
        },
        sheets: [
          {
            properties: {
              title: 'Revisions',
            },
          },
        ],
      },
    });

    const spreadsheetId = response.data.spreadsheetId!;
    
    // Set headers
    const headers = [
      'Topic ID',
      'Topic Name',
      'Subject',
      'Study Date',
      'Revision 1 Date',
      'Revision 2 Date',
      'Revision 3 Date',
      'Revision 4 Date',
      'Current Stage',
      'Status',
    ];

    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: 'Revisions!A1:J1',
      valueInputOption: 'RAW',
      requestBody: {
        values: [headers],
      },
    });

    await prisma.user.update({
      where: { id: userId },
      data: { googleSheetsId: spreadsheetId },
    });

    return spreadsheetId;
  } catch (error) {
    console.error('Error creating Google Spreadsheet:', error);
    return null;
  }
}

export async function syncTopicToGoogleSheets(userId: string, topicId: string) {
  try {
    const oauth2Client = await getGoogleClient(userId);
    const spreadsheetId = await getOrCreateSpreadsheet(userId);
    if (!oauth2Client || !spreadsheetId) return;

    const topic = await prisma.topic.findUnique({
      where: { id: topicId },
      include: {
        subject: true,
        revisions: { orderBy: { revisionNumber: 'asc' } },
      },
    });

    if (!topic) return;

    const sheets = google.sheets({ version: 'v4', auth: oauth2Client });

    // Read current rows to find if topic already exists
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: 'Revisions!A:A',
    });

    const rows = res.data.values || [];
    let rowIndex = -1;

    for (let i = 0; i < rows.length; i++) {
      if (rows[i][0] === topicId) {
        rowIndex = i + 1; // 1-indexed row number
        break;
      }
    }

    const rowData = [
      topic.id,
      topic.name,
      topic.subject.name,
      topic.studyDate.toISOString().split('T')[0],
      topic.revisions[0]?.scheduledDate.toISOString().split('T')[0] || '',
      topic.revisions[1]?.scheduledDate.toISOString().split('T')[0] || '',
      topic.revisions[2]?.scheduledDate.toISOString().split('T')[0] || '',
      topic.revisions[3]?.scheduledDate.toISOString().split('T')[0] || '',
      topic.stage.toString(),
      topic.status,
    ];

    if (rowIndex !== -1) {
      // Update existing row
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `Revisions!A${rowIndex}:J${rowIndex}`,
        valueInputOption: 'RAW',
        requestBody: {
          values: [rowData],
        },
      });
    } else {
      // Append new row
      await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: 'Revisions!A:J',
        valueInputOption: 'RAW',
        requestBody: {
          values: [rowData],
        },
      });
    }
  } catch (error) {
    console.error(`Error in syncTopicToGoogleSheets for topic ${topicId}:`, error);
  }
}

// ==========================================
// NOTION INTEGRATION
// ==========================================

export async function getOrCreateNotionDatabase(userId: string, notion: Client) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { notionDatabaseId: true },
  });

  if (user?.notionDatabaseId) {
    try {
      await notion.databases.retrieve({ database_id: user.notionDatabaseId });
      return user.notionDatabaseId;
    } catch (e) {
      console.warn('Notion database ID is invalid/deleted. Creating a new one.');
    }
  }

  // Create new Notion database
  // Requires user page selection, let's find the first shared page we can write inside
  try {
    const searchRes = await notion.search({
      filter: { property: 'object', value: 'page' },
      page_size: 1,
    });

    const parentPage = searchRes.results[0];
    if (!parentPage) {
      console.error('No pages shared with the Notion integration. Please share a page in Notion.');
      return null;
    }

    const dbResponse = await (notion.databases as any).create({
      parent: { type: 'page_id', page_id: parentPage.id },
      title: [
        {
          type: 'text',
          text: { content: 'Revision Tracker' },
        },
      ],
      properties: {
        'Topic Name': { title: {} },
        Subject: { select: {} }, // Multi-select or Select
        'Study Date': { date: {} },
        'Revision 1': { date: {} },
        'Revision 2': { date: {} },
        'Revision 3': { date: {} },
        'Revision 4': { date: {} },
        Stage: { number: {} },
        Status: {
          select: {
            options: [
              { name: 'PENDING', color: 'gray' },
              { name: 'DUE_TODAY', color: 'red' },
              { name: 'COMPLETED', color: 'green' },
              { name: 'MASTERED', color: 'blue' },
            ],
          },
        },
        'App Topic ID': { rich_text: {} },
      },
    });

    const databaseId = dbResponse.id;
    await prisma.user.update({
      where: { id: userId },
      data: { notionDatabaseId: databaseId },
    });

    return databaseId;
  } catch (error) {
    console.error('Error creating Notion database:', error);
    return null;
  }
}

export async function syncTopicToNotion(userId: string, topicId: string) {
  try {
    const notion = await getNotionClient(userId);
    if (!notion) return;

    const databaseId = await getOrCreateNotionDatabase(userId, notion);
    if (!databaseId) return;

    const topic = await prisma.topic.findUnique({
      where: { id: topicId },
      include: {
        subject: true,
        revisions: { orderBy: { revisionNumber: 'asc' } },
      },
    });

    if (!topic) return;

    // Check if subject is an option in Subject select property, if not it will auto create
    const properties: any = {
      'Topic Name': {
        title: [
          {
            text: { content: topic.name },
          },
        ],
      },
      Subject: {
        select: { name: topic.subject.name },
      },
      'Study Date': {
        date: { start: topic.studyDate.toISOString().split('T')[0] },
      },
      'Revision 1': topic.revisions[0]
        ? { date: { start: topic.revisions[0].scheduledDate.toISOString().split('T')[0] } }
        : undefined,
      'Revision 2': topic.revisions[1]
        ? { date: { start: topic.revisions[1].scheduledDate.toISOString().split('T')[0] } }
        : undefined,
      'Revision 3': topic.revisions[2]
        ? { date: { start: topic.revisions[2].scheduledDate.toISOString().split('T')[0] } }
        : undefined,
      'Revision 4': topic.revisions[3]
        ? { date: { start: topic.revisions[3].scheduledDate.toISOString().split('T')[0] } }
        : undefined,
      Stage: {
        number: topic.stage,
      },
      Status: {
        select: { name: topic.status },
      },
      'App Topic ID': {
        rich_text: [
          {
            text: { content: topic.id },
          },
        ],
      },
    };

    // Clean undefined keys
    Object.keys(properties).forEach(
      (key) => properties[key] === undefined && delete properties[key]
    );

    if (topic.notionPageId) {
      try {
        await notion.pages.update({
          page_id: topic.notionPageId,
          properties,
        });
      } catch (err: any) {
        if (err.status === 404) {
          // Page was deleted in Notion, recreate it
          const pageResponse = await notion.pages.create({
            parent: { type: 'database_id', database_id: databaseId },
            properties,
          });
          await prisma.topic.update({
            where: { id: topicId },
            data: { notionPageId: pageResponse.id },
          });
        } else {
          console.error(`Failed to update Notion page for topic ${topicId}:`, err);
        }
      }
    } else {
      const pageResponse = await notion.pages.create({
        parent: { type: 'database_id', database_id: databaseId },
        properties,
      });
      await prisma.topic.update({
        where: { id: topicId },
        data: { notionPageId: pageResponse.id },
      });
    }
  } catch (error) {
    console.error(`Error in syncTopicToNotion for topic ${topicId}:`, error);
  }
}

// ==========================================
// BIDIRECTIONAL SYNC ENGINE (INBOUND)
// ==========================================

export async function runNotionInboundSync(userId: string) {
  const notion = await getNotionClient(userId);
  if (!notion) return 0;

  const databaseId = await getOrCreateNotionDatabase(userId, notion);
  if (!databaseId) return 0;

  let updatedCount = 0;

  try {
    const response = await (notion.databases as any).query({
      database_id: databaseId,
    });

    for (const page of response.results as any[]) {
      const props = page.properties;
      const appTopicIdProp = props['App Topic ID']?.rich_text?.[0]?.text?.content;
      const topicName = props['Topic Name']?.title?.[0]?.text?.content;
      const subjectName = props['Subject']?.select?.name;
      const studyDateStr = props['Study Date']?.date?.start;
      const stageVal = props['Stage']?.number;
      const statusVal = props['Status']?.select?.name;

      if (!topicName || !subjectName || !studyDateStr) continue;

      const studyDate = new Date(studyDateStr);

      if (appTopicIdProp) {
        // Exists in app. Check if status, stage or studyDate has changed in Notion
        const topic = await prisma.topic.findUnique({
          where: { id: appTopicIdProp },
          include: { subject: true, revisions: true },
        });

        if (topic) {
          let needsUpdate = false;
          let newStage = topic.stage;
          let newStatus = topic.status;
          let newStudyDate = topic.studyDate;

          // If stage changed in Notion
          if (stageVal !== undefined && stageVal !== topic.stage) {
            newStage = Math.max(0, Math.min(5, stageVal));
            needsUpdate = true;
          }

          // If status changed in Notion
          if (statusVal && statusVal !== topic.status) {
            newStatus = statusVal;
            needsUpdate = true;
          }

          // If study date changed in Notion
          if (studyDateStr && studyDate.getTime() !== topic.studyDate.getTime()) {
            newStudyDate = studyDate;
            needsUpdate = true;
          }

          if (needsUpdate) {
            updatedCount++;
            
            // If study date changed, we recalculate revisions
            if (newStudyDate.getTime() !== topic.studyDate.getTime()) {
              // Delete old revisions and recreate them
              await prisma.revisionSchedule.deleteMany({ where: { topicId: topic.id } });
              
              const revisionIntervals = [1, 2, 4, 8];
              const newRevisionsData = revisionIntervals.map((days, index) => {
                const scheduledDate = new Date(newStudyDate);
                scheduledDate.setDate(scheduledDate.getDate() + days);
                return {
                  revisionNumber: index + 1,
                  scheduledDate,
                  status: 'PENDING' as const,
                };
              });

              await prisma.topic.update({
                where: { id: topic.id },
                data: {
                  name: topicName,
                  studyDate: newStudyDate,
                  stage: newStage,
                  status: newStatus,
                  revisions: {
                    create: newRevisionsData,
                  },
                },
              });
            } else {
              // Standard stage/status update
              await prisma.topic.update({
                where: { id: topic.id },
                data: {
                  stage: newStage,
                  status: newStatus,
                },
              });

              // Update corresponding revisions based on new stage
              // If stage is COMPLETED, mark revisions 1..stage as completed
              for (let i = 1; i <= 4; i++) {
                const revStatus = i <= newStage ? 'COMPLETED' : 'PENDING';
                const revSchedule = topic.revisions.find((r) => r.revisionNumber === i);
                if (revSchedule) {
                  await prisma.revisionSchedule.update({
                    where: { id: revSchedule.id },
                    data: {
                      status: revStatus,
                      completedDate: revStatus === 'COMPLETED' ? new Date() : null,
                    },
                  });
                }
              }
            }

            // Sync modifications outward to sheets and calendar
            await syncTopicToGoogleSheets(userId, topic.id);
            await syncTopicToGoogleCalendar(userId, topic.id);
          }
        }
      } else {
        // Manually created page in Notion, import into database!
        updatedCount++;
        
        let subject = await prisma.subject.findFirst({
          where: { name: subjectName, userId },
        });

        if (!subject) {
          subject = await prisma.subject.create({
            data: { name: subjectName, userId },
          });
        }

        const newTopic = await prisma.topic.create({
          data: {
            name: topicName,
            subjectId: subject.id,
            userId,
            studyDate,
            stage: stageVal || 0,
            status: (statusVal as any) || 'PENDING',
            notionPageId: page.id,
          },
        });

        // Create the 4 spaced repetitions
        const revisionIntervals = [1, 2, 4, 8];
        const revisionsData = revisionIntervals.map((days, index) => {
          const scheduledDate = new Date(studyDate);
          scheduledDate.setDate(scheduledDate.getDate() + days);
          return {
            topicId: newTopic.id,
            revisionNumber: index + 1,
            scheduledDate,
            status: (stageVal && index + 1 <= stageVal) ? ('COMPLETED' as const) : ('PENDING' as const),
            completedDate: (stageVal && index + 1 <= stageVal) ? new Date() : null,
          };
        });

        await prisma.revisionSchedule.createMany({
          data: revisionsData,
        });

        // Propagate app database Topic ID back to Notion
        await syncTopicToNotion(userId, newTopic.id);
        // Sync to Sheets & Calendar
        await syncTopicToGoogleSheets(userId, newTopic.id);
        await syncTopicToGoogleCalendar(userId, newTopic.id);
      }
    }
  } catch (error) {
    console.error('Error during Notion inbound sync:', error);
  }

  return updatedCount;
}

export async function runGoogleSheetsInboundSync(userId: string) {
  const oauth2Client = await getGoogleClient(userId);
  const spreadsheetId = await getOrCreateSpreadsheet(userId);
  if (!oauth2Client || !spreadsheetId) return 0;

  const sheets = google.sheets({ version: 'v4', auth: oauth2Client });
  let updatedCount = 0;

  try {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: 'Revisions!A:J',
    });

    const rows = res.data.values || [];
    if (rows.length <= 1) return 0; // Only headers

    const headers = rows[0];
    const dataRows = rows.slice(1);

    for (const row of dataRows) {
      const topicId = row[0];
      const topicName = row[1];
      const subjectName = row[2];
      const studyDateStr = row[3];
      const stageStr = row[8];
      const statusStr = row[9];

      if (!topicName || !subjectName || !studyDateStr) continue;

      const studyDate = new Date(studyDateStr);
      const stageVal = stageStr ? parseInt(stageStr, 10) : 0;

      if (topicId) {
        // Exists in DB, check for difference
        const topic = await prisma.topic.findUnique({
          where: { id: topicId },
          include: { revisions: true },
        });

        if (topic) {
          let needsUpdate = false;
          let newStage = topic.stage;
          let newStatus = topic.status;
          let newStudyDate = topic.studyDate;

          if (stageVal !== topic.stage) {
            newStage = Math.max(0, Math.min(5, stageVal));
            needsUpdate = true;
          }

          if (statusStr && statusStr !== topic.status) {
            newStatus = statusStr as any;
            needsUpdate = true;
          }

          if (studyDate.getTime() !== topic.studyDate.getTime()) {
            newStudyDate = studyDate;
            needsUpdate = true;
          }

          if (needsUpdate) {
            updatedCount++;

            if (newStudyDate.getTime() !== topic.studyDate.getTime()) {
              await prisma.revisionSchedule.deleteMany({ where: { topicId: topic.id } });
              
              const revisionIntervals = [1, 2, 4, 8];
              const newRevisionsData = revisionIntervals.map((days, index) => {
                const scheduledDate = new Date(newStudyDate);
                scheduledDate.setDate(scheduledDate.getDate() + days);
                return {
                  revisionNumber: index + 1,
                  scheduledDate,
                  status: 'PENDING' as const,
                };
              });

              await prisma.topic.update({
                where: { id: topic.id },
                data: {
                  name: topicName,
                  studyDate: newStudyDate,
                  stage: newStage,
                  status: newStatus,
                  revisions: {
                    create: newRevisionsData,
                  },
                },
              });
            } else {
              await prisma.topic.update({
                where: { id: topic.id },
                data: {
                  stage: newStage,
                  status: newStatus,
                },
              });

              for (let i = 1; i <= 4; i++) {
                const revStatus = i <= newStage ? 'COMPLETED' : 'PENDING';
                const revSchedule = topic.revisions.find((r) => r.revisionNumber === i);
                if (revSchedule) {
                  await prisma.revisionSchedule.update({
                    where: { id: revSchedule.id },
                    data: {
                      status: revStatus,
                      completedDate: revStatus === 'COMPLETED' ? new Date() : null,
                    },
                  });
                }
              }
            }

            // Sync modifications outward
            await syncTopicToNotion(userId, topic.id);
            await syncTopicToGoogleCalendar(userId, topic.id);
          }
        }
      } else {
        // Manually created row in Google Sheets, import to database!
        updatedCount++;

        let subject = await prisma.subject.findFirst({
          where: { name: subjectName, userId },
        });

        if (!subject) {
          subject = await prisma.subject.create({
            data: { name: subjectName, userId },
          });
        }

        const newTopic = await prisma.topic.create({
          data: {
            name: topicName,
            subjectId: subject.id,
            userId,
            studyDate,
            stage: stageVal,
            status: (statusStr as any) || 'PENDING',
          },
        });

        // Create the 4 spaced repetitions
        const revisionIntervals = [1, 2, 4, 8];
        const revisionsData = revisionIntervals.map((days, index) => {
          const scheduledDate = new Date(studyDate);
          scheduledDate.setDate(scheduledDate.getDate() + days);
          return {
            topicId: newTopic.id,
            revisionNumber: index + 1,
            scheduledDate,
            status: (stageVal && index + 1 <= stageVal) ? ('COMPLETED' as const) : ('PENDING' as const),
            completedDate: (stageVal && index + 1 <= stageVal) ? new Date() : null,
          };
        });

        await prisma.revisionSchedule.createMany({
          data: revisionsData,
        });

        // Sync local topic ID back to Sheets (updating this row)
        await syncTopicToGoogleSheets(userId, newTopic.id);
        // Sync to Notion & Calendar
        await syncTopicToNotion(userId, newTopic.id);
        await syncTopicToGoogleCalendar(userId, newTopic.id);
      }
    }
  } catch (error) {
    console.error('Error during Google Sheets inbound sync:', error);
  }

  return updatedCount;
}

// Orchestrator to run all sync workflows
export async function runFullSync(userId: string) {
  let count = 0;
  
  // 1. Fetch changes from Notion and write to App (which triggers outwards to Sheets/Calendar)
  count += await runNotionInboundSync(userId);

  // 2. Fetch changes from Google Sheets and write to App (which triggers outwards to Notion/Calendar)
  count += await runGoogleSheetsInboundSync(userId);

  // 3. For all current topics, ensure they are synced outbound to Sheets & Notion in case they were only created locally
  const topics = await prisma.topic.findMany({
    where: { userId },
    select: { id: true },
  });

  for (const topic of topics) {
    await syncTopicToGoogleSheets(userId, topic.id);
    await syncTopicToNotion(userId, topic.id);
    await syncTopicToGoogleCalendar(userId, topic.id);
  }

  // Update last sync time
  await prisma.user.update({
    where: { id: userId },
    data: { timezone: undefined }, // Keep user settings active
  });

  return count;
}
