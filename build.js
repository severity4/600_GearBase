#!/usr/bin/env node
/**
 * Build Script - Assembles frontend HTML files for Railway deployment
 * Combines src/ HTML templates into public/ standalone files
 * Replaces GAS <?!= include('...') ?> with actual file contents
 */
const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, 'src');
const publicDir = path.join(__dirname, 'public');
const jsDir = path.join(publicDir, 'js');

// Ensure directories exist
if (!fs.existsSync(publicDir)) fs.mkdirSync(publicDir, { recursive: true });
if (!fs.existsSync(jsDir)) fs.mkdirSync(jsDir, { recursive: true });

// Read source files
const stylesHtml = fs.readFileSync(path.join(srcDir, 'Styles.html'), 'utf-8');
const javascriptHtml = fs.readFileSync(path.join(srcDir, 'JavaScript.html'), 'utf-8');
const staffHtml = fs.readFileSync(path.join(srcDir, 'StaffApp.html'), 'utf-8');
const customerHtml = fs.readFileSync(path.join(srcDir, 'CustomerApp.html'), 'utf-8');

// Extract content from HTML wrappers
function extractContent(html) {
  // Remove outer <!DOCTYPE html><html><head> ... </head></html> wrapper
  return html
    .replace(/^<!DOCTYPE html>\s*<html>\s*<head>\s*/i, '')
    .replace(/\s*<\/head>\s*<\/html>\s*$/i, '')
    .trim();
}

// Extract just the <style>...</style> from Styles.html
const stylesContent = extractContent(stylesHtml);

// Extract just the <script>...</script> from JavaScript.html
// But replace the google.script.run wrapper with our fetch-based one
let jsContent = extractContent(javascriptHtml);

// Remove the google.script.run-based API wrapper and runAsync function
// We'll replace them with our fetch-based api.js
// Find the API object and runAsync function and strip them
const apiStartMarker = '// ==================== API WRAPPER ====================';
const apiEndMarker = '// ==================== HTML SANITIZATION ====================';

const apiStart = jsContent.indexOf(apiStartMarker);
const apiEnd = jsContent.indexOf(apiEndMarker);

if (apiStart !== -1 && apiEnd !== -1) {
  jsContent = jsContent.substring(0, apiStart) +
    '// API wrapper loaded from /public/js/api.js\n' +
    jsContent.substring(apiEnd);
}

// Also remove the API monitor renderince it's already in api.js - actually keep it, it's UI
// Remove debug mode flag since we set it in api.js
jsContent = jsContent.replace(/const CLIENT_DEBUG = false;/, '// CLIENT_DEBUG defined in api.js');

function buildPage(pageHtml, pageName) {
  let output = pageHtml;

  // Replace <?!= include('Styles') ?> with actual CSS
  output = output.replace(/<\?!=?\s*include\(['"]Styles['"]\)\s*\?>/g, stylesContent);

  // Replace <?!= include('JavaScript') ?> with our api.js + utilities
  output = output.replace(/<\?!=?\s*include\(['"]JavaScript['"]\)\s*\?>/g,
    `<script src="/public/js/api.js"></script>\n${jsContent}`
  );

  // Add login gate for staff app
  if (pageName === 'staff') {
    // Add login check script before closing </body>
    const loginScript = `
<script>
  // Check auth on page load
  (function() {
    const token = localStorage.getItem('gearbase_token');
    if (!token) {
      showLoginModal();
      return;
    }
    // Verify token is still valid
    API.getCurrentUserInfo().then(user => {
      if (typeof initApp === 'function') initApp(user);
    }).catch(() => {
      localStorage.removeItem('gearbase_token');
      showLoginModal();
    });
  })();

  function showLoginModal() {
    const overlay = document.createElement('div');
    overlay.id = 'login-overlay';
    overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:linear-gradient(135deg,#1e293b 0%,#334155 100%);display:flex;align-items:center;justify-content:center;z-index:99999;';
    overlay.innerHTML = \`
      <div style="background:white;border-radius:16px;padding:40px;width:380px;box-shadow:0 20px 60px rgba(0,0,0,0.3);">
        <h2 style="text-align:center;margin-bottom:8px;color:#1e293b;">映奧創意工作室</h2>
        <p style="text-align:center;color:#64748b;margin-bottom:24px;">器材管理系統</p>
        <div id="login-error" style="display:none;background:#fef2f2;color:#dc2626;padding:8px 12px;border-radius:8px;margin-bottom:16px;font-size:14px;"></div>
        <form id="login-form">
          <div style="margin-bottom:16px;">
            <label style="display:block;margin-bottom:4px;font-weight:500;color:#334155;">Email</label>
            <input type="email" id="login-email" required style="width:100%;padding:10px 14px;border:1px solid #e2e8f0;border-radius:8px;font-size:15px;" placeholder="your@email.com">
          </div>
          <div style="margin-bottom:24px;">
            <label style="display:block;margin-bottom:4px;font-weight:500;color:#334155;">密碼</label>
            <input type="password" id="login-password" required style="width:100%;padding:10px 14px;border:1px solid #e2e8f0;border-radius:8px;font-size:15px;" placeholder="••••••••">
          </div>
          <button type="submit" style="width:100%;padding:12px;background:#3b82f6;color:white;border:none;border-radius:8px;font-size:16px;font-weight:600;cursor:pointer;">登入</button>
        </form>
        <div id="bootstrap-section" style="margin-top:16px;text-align:center;">
          <button onclick="showBootstrap()" style="background:none;border:none;color:#64748b;cursor:pointer;font-size:13px;">首次使用？建立管理員帳號</button>
        </div>
      </div>
    \`;
    document.body.appendChild(overlay);

    document.getElementById('login-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const errEl = document.getElementById('login-error');
      errEl.style.display = 'none';
      try {
        const result = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: document.getElementById('login-email').value,
            password: document.getElementById('login-password').value,
          }),
        }).then(r => r.json());

        if (result.error) throw new Error(result.error);

        setAuthToken(result.token);
        overlay.remove();
        if (typeof initApp === 'function') initApp(result.user);
      } catch (err) {
        errEl.textContent = err.message;
        errEl.style.display = 'block';
      }
    });
  }

  function showBootstrap() {
    const section = document.getElementById('bootstrap-section');
    section.innerHTML = \`
      <div style="margin-top:16px;padding:16px;background:#f8fafc;border-radius:8px;">
        <p style="font-size:13px;color:#64748b;margin-bottom:12px;">建立第一個管理員帳號</p>
        <form id="bootstrap-form">
          <input type="text" id="bs-name" placeholder="姓名" style="width:100%;padding:8px 12px;border:1px solid #e2e8f0;border-radius:6px;margin-bottom:8px;font-size:14px;">
          <input type="email" id="bs-email" placeholder="Email" required style="width:100%;padding:8px 12px;border:1px solid #e2e8f0;border-radius:6px;margin-bottom:8px;font-size:14px;">
          <input type="password" id="bs-password" placeholder="密碼" required style="width:100%;padding:8px 12px;border:1px solid #e2e8f0;border-radius:6px;margin-bottom:12px;font-size:14px;">
          <button type="submit" style="width:100%;padding:8px;background:#10b981;color:white;border:none;border-radius:6px;font-size:14px;cursor:pointer;">建立帳號</button>
        </form>
        <div id="bs-error" style="display:none;color:#dc2626;font-size:13px;margin-top:8px;"></div>
      </div>
    \`;
    document.getElementById('bootstrap-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const errEl = document.getElementById('bs-error');
      errEl.style.display = 'none';
      try {
        const result = await fetch('/api/auth/bootstrap', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: document.getElementById('bs-name').value,
            email: document.getElementById('bs-email').value,
            password: document.getElementById('bs-password').value,
          }),
        }).then(r => r.json());

        if (result.error) throw new Error(result.error);

        setAuthToken(result.token);
        document.getElementById('login-overlay').remove();
        if (typeof initApp === 'function') initApp(result.user);
      } catch (err) {
        errEl.textContent = err.message;
        errEl.style.display = 'block';
      }
    });
  }
</script>`;

    output = output.replace('</body>', loginScript + '\n</body>');
  }

  return output;
}

// Build staff app
const staffOutput = buildPage(staffHtml, 'staff');
fs.writeFileSync(path.join(publicDir, 'staff.html'), staffOutput);
console.log('Built public/staff.html');

// Build customer app
const customerOutput = buildPage(customerHtml, 'customer');
fs.writeFileSync(path.join(publicDir, 'customer.html'), customerOutput);
console.log('Built public/customer.html');

console.log('Build complete!');
