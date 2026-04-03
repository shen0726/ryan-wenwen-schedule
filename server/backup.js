const fs = require('fs');
const path = require('path');

// GitHub Gist 备份配置
const GIST_TOKEN = process.env.GIST_TOKEN;
const GIST_ID = process.env.GIST_ID; // 如果有现有 Gist ID
const BACKUP_FILES = ['users.json', 'events.json', 'subscriptions.json', 'participants.json'];

// 创建或更新 GitHub Gist
async function backupToGist() {
  if (!GIST_TOKEN) {
    console.log('GIST_TOKEN not set, skipping backup');
    return;
  }

  const dataDir = path.join(__dirname, 'data');
  const files = {};

  // 读取所有数据文件
  for (const filename of BACKUP_FILES) {
    const filepath = path.join(dataDir, filename);
    if (fs.existsSync(filepath)) {
      const content = fs.readFileSync(filepath, 'utf8');
      // Gist API 要求文件内容
      files[filename] = { content };
    }
  }

  try {
    let response;

    if (GIST_ID) {
      // 更新现有 Gist
      response = await fetch(`https://api.github.com/gists/${GIST_ID}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `token ${GIST_TOKEN}`,
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          description: `Schedule App Backup - ${new Date().toISOString()}`,
          files
        })
      });
    } else {
      // 创建新 Gist
      response = await fetch('https://api.github.com/gists', {
        method: 'POST',
        headers: {
          'Authorization': `token ${GIST_TOKEN}`,
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          description: `Schedule App Backup - ${new Date().toISOString()}`,
          public: false,
          files
        })
      });
    }

    if (!response.ok) {
      const error = await response.text();
      console.error('Backup failed:', error);
      return;
    }

    const result = await response.json();
    console.log(`Backup successful: ${result.html_url}`);

    // 如果是新创建的 Gist，记录 ID
    if (!GIST_ID) {
      console.log(`GIST_ID: ${result.id}`);
      console.log('Add this GIST_ID to environment variables for future backups');
    }
  } catch (err) {
    console.error('Backup error:', err.message);
  }
}

// 从 Gist 恢复数据
async function restoreFromGist() {
  if (!GIST_TOKEN || !GIST_ID) {
    console.log('GIST_TOKEN or GIST_ID not set, skipping restore');
    return false;
  }

  try {
    const response = await fetch(`https://api.github.com/gists/${GIST_ID}`, {
      headers: {
        'Authorization': `token ${GIST_TOKEN}`,
        'Accept': 'application/vnd.github.v3+json'
      }
    });

    if (!response.ok) {
      console.error('Restore failed:', await response.text());
      return false;
    }

    const result = await response.json();
    const dataDir = path.join(__dirname, 'data');

    // 恢复每个文件
    for (const filename of BACKUP_FILES) {
      if (result.files[filename]) {
        const content = result.files[filename].content;
        fs.writeFileSync(path.join(dataDir, filename), content, 'utf8');
        console.log(`Restored: ${filename}`);
      }
    }

    console.log('Restore completed successfully');
    return true;
  } catch (err) {
    console.error('Restore error:', err.message);
    return false;
  }
}

module.exports = { backupToGist, restoreFromGist };
