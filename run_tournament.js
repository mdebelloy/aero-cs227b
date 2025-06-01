//--------------------------------------------------------------------
// Updated BASE URLs – removed deprecated "/homepage" directory.
// These endpoints occasionally force an https redirect that leads to a 404
// because the same path does not exist on the https virtual host.  Using the
// root URLs (without /homepage) avoids that situation.
//--------------------------------------------------------------------

const BASE        = 'http://gamemaster.stanford.edu/homepage';
// Endpoints under /homepage are stable on HTTP; the root versions redirect to HTTPS.
const LOGIN_URL   = `${BASE}/signin.php`;          // sign-in form (HTTP-only)
const UPLOAD_URL  = `${BASE}/uploadplayer.php`;    // player upload (HTTP-only)
const RUN_URL     = `${BASE}/run.php`;             // match launcher (HTTP-only)


const PLAYER_CODE     = 'aero';
const PLAYER_PASSWORD = '460264';
const AERO_FILE       = './aero_final.html';  // relative or absolute

const GAME            = 'TicTacToe3';         // value in <option>
const OPPONENT        = 'zj';  // Focus on zj opponent
const RUNS_PER_ROLE   = 5;                   // 30 as X + 30 as O
const GAMES_PAGE      = 'http://gamemaster.stanford.edu/homepage/showgames.php';
const PLAYERS_PAGE    = 'http://gamemaster.stanford.edu/homepage/showplayers.php';
//------------------------------------------------------------

const puppeteer = require('puppeteer');
const fs        = require('fs');

//--------------------------------------------------------------------

async function login(page) {
  console.log('🛫 Opening GameMaster...');
  
  // Try to go to the HTTP login page
  try {
    await page.goto(LOGIN_URL, { waitUntil: 'domcontentloaded', timeout: 5000 });
  } catch (e) {
    console.log('⚠️  Initial navigation failed, but continuing...');
  }

  console.log('\n' + '='.repeat(70));
  console.log('👤 MANUAL LOGIN REQUIRED');
  console.log('='.repeat(70));
  console.log('⚠️  IMPORTANT: The HTTPS version gives 404 - you MUST use HTTP!\n');
  console.log('Please follow these steps EXACTLY:');
  console.log('1. If you see a 404 error, look at the address bar');
  console.log('2. Change "https://" to "http://" in the URL');
  console.log('3. The correct URL is:');
  console.log('   http://gamemaster.stanford.edu/homepage/signin.php');
  console.log('   (NOT https - the HTTPS version doesn\'t exist!)');
  console.log('4. Press Enter to load the HTTP version');
  console.log('5. Enter your credentials:');
  console.log(`   - Username: ${PLAYER_CODE}`);
  console.log(`   - Password: ${PLAYER_PASSWORD}`);
  console.log('6. Click "Sign In"');
  console.log('7. After login, the site may redirect to HTTPS - that\'s OK');
  console.log('\nThe script will continue automatically once logged in...');
  console.log('='.repeat(70) + '\n');

  // Wait for the game dropdown to appear (indicates successful login)
  let loginDetected = false;
  let checkInterval;
  try {
    // Add debugging to see what's happening
    console.log('⏳ Waiting for login confirmation...');
    
    // Poll every 2 seconds to check page status and provide feedback
    checkInterval = setInterval(async () => {
      if (loginDetected) return; // Stop checking once detected
      try {
        const pageInfo = await page.evaluate(() => {
          return {
            url: window.location.href,
            title: document.title,
            hasGameSelect: !!document.querySelector('select[name="game"]'),
            hasPlayerLink: !!document.querySelector('a[href*="player"]'),
            hasUploadLink: !!document.querySelector('a[href*="upload"]'),
            hasRunLink: !!document.querySelector('a[href*="run.php"]'),
            bodyText: document.body.innerText.substring(0, 200)
          };
        });
        console.log('📍 Current page:', pageInfo.url);
        console.log('📄 Page title:', pageInfo.title);
        console.log('🎮 Game select found:', pageInfo.hasGameSelect);
        console.log('👤 Player link found:', pageInfo.hasPlayerLink);
        console.log('📤 Upload link found:', pageInfo.hasUploadLink);
        console.log('🏃 Run link found:', pageInfo.hasRunLink);
        console.log('📝 Page preview:', pageInfo.bodyText.replace(/\n/g, ' ').substring(0, 100) + '...');
        console.log('---');
      } catch (e) {
        // Page might be navigating
        console.log('⚠️ Page might be navigating...');
      }
    }, 2000);
    
    // Wait for the actual dashboard, not just index.php
    console.log('🔍 Looking for dashboard elements...');
    await page.waitForFunction(() => {
      // Must be on a page that's NOT signin.php and has dashboard elements
      const url = window.location.href;
      const notLoginPage = !url.includes('signin.php');
      
      // Look for elements that indicate we're on the dashboard
      const hasUploadLink = !!document.querySelector('a[href*="uploadplayer"]');
      const hasRunLink = !!document.querySelector('a[href*="run.php"]');
      const hasPlayerInfo = document.body.textContent.includes('Player:') || 
                           document.body.textContent.includes('aero');
      
      // We need to be off the login page AND have dashboard elements
      return notLoginPage && (hasUploadLink || hasRunLink || hasPlayerInfo);
    }, { timeout: 300_000 });
    
    loginDetected = true;
    clearInterval(checkInterval);
    
    console.log('\n✅ Login detected! Dashboard loaded.');
    
    // Get final page info
    const finalInfo = await page.evaluate(() => {
      return {
        url: window.location.href,
        title: document.title,
        links: Array.from(document.querySelectorAll('a')).map(a => a.textContent + ' -> ' + a.href).slice(0, 10)
      };
    });
    
    console.log('📍 Dashboard URL:', finalInfo.url);
    console.log('📄 Dashboard title:', finalInfo.title);
    console.log('🔗 Available links:', finalInfo.links);
    
    // Small delay to ensure page is fully loaded
    console.log('⏳ Waiting 2 seconds for page to stabilize...');
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    console.log('✅ Ready to continue with automated tournament!\n');
  } catch (e) {
    clearInterval(checkInterval);
    console.error('❌ Login detection failed:', e.message);
    // Only throw timeout error if it's actually a timeout
    if (e.message.includes('timeout')) {
      throw new Error('Manual login timeout after 5 minutes. The script was looking for dashboard elements but couldn\'t find them.');
    } else {
      throw e; // Re-throw the actual error
    }
  }
}

  

  

async function uploadPlayer(page) {
  console.log('📤 Navigating to player upload page...');
  
  // Go to profile page which has the upload functionality
  const profileUrl = 'http://gamemaster.stanford.edu/homepage/profile.php';
  console.log('📍 Going to profile page:', profileUrl);
  
  try {
    await page.goto(profileUrl, { waitUntil: 'networkidle2', timeout: 10000 });
  } catch (e) {
    console.log('⚠️  Profile page navigation timeout, but continuing...');
  }
  
  // Debug: Check what's on the page
  const pageInfo = await page.evaluate(() => {
    const forms = Array.from(document.querySelectorAll('form')).map(f => ({
      action: f.action,
      method: f.method,
      inputs: Array.from(f.querySelectorAll('input')).map(i => ({
        type: i.type,
        name: i.name,
        value: i.value
      }))
    }));
    return {
      url: window.location.href,
      title: document.title,
      forms: forms,
      fileInputs: Array.from(document.querySelectorAll('input[type="file"]')).map(i => ({
        name: i.name,
        id: i.id
      }))
    };
  });
  
  console.log('📍 Upload page URL:', pageInfo.url);
  console.log('📄 Page title:', pageInfo.title);
  console.log('📝 File inputs found:', pageInfo.fileInputs);
  console.log('📋 Forms on page:', pageInfo.forms.length);

  // Check if player might already be uploaded
  const pageText = await page.evaluate(() => document.body.innerText);
  if (pageText.toLowerCase().includes('aero') && 
      (pageText.toLowerCase().includes('already') || 
       pageText.toLowerCase().includes('exists') ||
       pageText.toLowerCase().includes('uploaded') ||
       pageText.toLowerCase().includes('player: aero'))) {
    console.log('ℹ️  Player "aero" appears to already be uploaded, skipping upload...');
    return;
  }

  // file input: <input type="file" name="file">
  let fileInput;
  try {
    await page.waitForSelector('input[type="file"]', { timeout: 3000 });
    fileInput = await page.$('input[type="file"][name="file"]');
  } catch (e) {
    console.log('⚠️  No file input found on profile page');
    // Check if we're already signed in with aero
    if (pageText.includes('Player: aero') || pageText.includes('aero')) {
      console.log('✅ Player "aero" is already active, proceeding to tournaments...');
      return;
    }
    // If no file input and no player, just continue anyway
    console.log('⚠️  Cannot find upload form, but continuing to tournament...');
    return;
  }
  
  if (!fileInput) {
    console.log('ℹ️  No upload needed or player already exists');
    return;
  }
  
  try {
    console.log('📁 Uploading file:', AERO_FILE);
    await fileInput.uploadFile(AERO_FILE);

    // password field for upload confirmation: <input name="password">
    await page.waitForSelector('input[name="password"]', { timeout: 5000 });
    await page.type('input[name="password"]', PLAYER_PASSWORD);

    // submit: the only <input type="submit"> on the form
    await page.click('input[type="submit"]');

    // Wait for "Player uploaded" message
    try {
      await page.waitForFunction(() => {
        const bodyText = document.body.innerText.toLowerCase();
        return bodyText.includes('uploaded') || 
               bodyText.includes('success') ||
               bodyText.includes('already exists');
      }, { timeout: 10000 });
      
      const resultText = await page.evaluate(() => document.body.innerText);
      if (resultText.toLowerCase().includes('already exists')) {
        console.log('ℹ️  Player already uploaded, continuing...');
      } else {
        console.log('✅ Successfully uploaded', AERO_FILE);
      }
    } catch (e) {
      console.error('⚠️  Upload confirmation timeout, but continuing anyway...');
    }
  } catch (e) {
    console.error('⚠️  Upload process failed:', e.message);
    console.log('   Continuing to tournament anyway...');
  }
}

async function openManagerWindow(browser, dashboardPage) {
  console.log('\n🎮 Opening Game Manager...');
  
  // Navigate to games page
  console.log('📍 Going to games page...');
  await dashboardPage.goto(GAMES_PAGE, { waitUntil: 'networkidle2' });
  
  // Find the TicTacToe3 row and click Manager
  console.log(`🔍 Looking for ${GAME} Manager link...`);
  const managerLink = await dashboardPage.evaluateHandle((gameName) => {
    // Find all rows
    const rows = Array.from(document.querySelectorAll('tr'));
    for (const row of rows) {
      const cells = row.querySelectorAll('td');
      if (cells.length > 0 && cells[0].textContent.trim() === gameName.toLowerCase()) {
        // Found the game row, find the Manager link
        const links = row.querySelectorAll('a');
        for (const link of links) {
          if (link.textContent.includes('Manager')) {
            return link;
          }
        }
      }
    }
    return null;
  }, GAME);
  
  if (!managerLink) {
    throw new Error(`Could not find Manager link for ${GAME}`);
  }
  
  // Click the manager link - it opens in a new window
  await managerLink.click();
  
  // Wait for the manager window to open
  const managerTarget = await browser.waitForTarget(t => 
    t.url().includes('manager') || t.url().includes('gamemaster')
  );
  const managerPage = await managerTarget.page();
  
  console.log('✅ Manager window opened');
  return managerPage;
}

async function openPlayerWindow(browser, dashboardPage, playerName) {
  console.log(`\n👤 Opening player window for: ${playerName}`);
  
  // Navigate to players page
  await dashboardPage.goto(PLAYERS_PAGE, { waitUntil: 'networkidle2' });
  
  // Find and click the player link
  const playerLink = await dashboardPage.$(`a[href*="${playerName}"]`);
  if (!playerLink) {
    throw new Error(`Could not find player link for ${playerName}`);
  }
  
  await playerLink.click();
  
  // Wait for the player window to open
  const playerTarget = await browser.waitForTarget(t => 
    t.url().includes(playerName) || t.url().includes('player')
  );
  const playerPage = await playerTarget.page();
  
  console.log(`✅ Player window opened for ${playerName}`);
  return playerPage;
}

async function runTournament(browser, dashboardPage) {
  console.log('\n🏆 Starting Tournament: Aero vs', OPPONENT);
  
  // Direct URLs for the game
  const MANAGER_URL = 'http://gamemaster.stanford.edu/homepage/manager.php?game=tictactoe3';
  const AERO_PLAYER_URL = 'http://gamemaster.stanford.edu/gameplayers/aero.html';
  const ZJ_PLAYER_URL = 'http://gamemaster.stanford.edu/gameplayers/zj.html';
  
  console.log('\n📂 Opening game windows...');
  
  // Open player windows first
  console.log('👤 Opening Aero player window...');
  const aeroPage = await browser.newPage();
  await aeroPage.goto(AERO_PLAYER_URL, { waitUntil: 'networkidle2' });
  
  console.log('👤 Opening ZJ player window...');
  const zjPage = await browser.newPage();
  await zjPage.goto(ZJ_PLAYER_URL, { waitUntil: 'networkidle2' });
  
  // Open manager window
  console.log('🎮 Opening Manager window...');
  const managerPage = await browser.newPage();
  await managerPage.goto(MANAGER_URL, { waitUntil: 'networkidle2' });
  
  // Give everything time to load
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Now set up the players in the manager
  console.log('\n⚙️  Setting up players in manager...');
  
  // First, reduce the clocks for faster games
  console.log('⏱️  Setting faster game clocks...');
  try {
    // Find and update startclock
    const startclockInput = await managerPage.$('input[value="10"]:first-of-type');
    if (startclockInput) {
      await startclockInput.click({ clickCount: 3 }); // Select all
      await startclockInput.type('5'); // 5 seconds
    }
    
    // Find and update playclock
    const playclockInputs = await managerPage.$$('input[value="10"]');
    if (playclockInputs.length > 1) {
      await playclockInputs[1].click({ clickCount: 3 }); // Select all
      await playclockInputs[1].type('5'); // 5 seconds
    }
  } catch (e) {
    console.log('⚠️  Could not update clocks, using defaults');
  }
  
  // Now enter player identifiers
  console.log('👤 Entering player identifiers...');
  
  // Find the cells with "anonymous" and replace them
  await managerPage.evaluate(() => {
    // Get all table cells
    const cells = Array.from(document.querySelectorAll('td'));
    
    // Find anonymous cells in the Players row
    let anonymousCount = 0;
    cells.forEach(cell => {
      if (cell.textContent.trim() === 'anonymous') {
        // Click on the cell to make it editable
        cell.click();
        
        // Try to find an input field that might appear
        setTimeout(() => {
          const input = cell.querySelector('input') || document.activeElement;
          if (input && input.tagName === 'INPUT') {
            if (anonymousCount === 0) {
              input.value = 'aero';
            } else {
              input.value = 'zj';
            }
            input.blur(); // Trigger change
            // Also try pressing Enter
            input.dispatchEvent(new KeyboardEvent('keypress', { key: 'Enter', keyCode: 13 }));
          } else {
            // Try direct text replacement
            if (anonymousCount === 0) {
              cell.textContent = 'aero';
            } else {
              cell.textContent = 'zj';
            }
          }
          anonymousCount++;
        }, 100);
      }
    });
  });
  
  // Wait for changes to take effect
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Ping players to ensure they're ready
  console.log('\n🏓 Pinging players...');
  const pingButton = await managerPage.$('input[value="Ping"]');
  if (pingButton) {
    // Set up dialog handler before clicking ping
    managerPage.once('dialog', async dialog => {
      console.log('📢 Ping response:', dialog.message());
      if (dialog.message().includes('ready')) {
        console.log('✅ All players ready!');
      }
      await dialog.accept(); // Click OK
    });
    
    await pingButton.click();
    
    // Wait for dialog to be handled
    await new Promise(resolve => setTimeout(resolve, 1000));
  } else {
    console.log('⚠️  Could not find Ping button');
  }
  
  // Run matches
  console.log('\n🎯 Starting matches...');
  const results = { wins: 0, draws: 0, losses: 0 };
  
  // Wait a bit before starting matches
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  for (let i = 0; i < RUNS_PER_ROLE * 2; i++) {
    console.log(`\n📊 Match ${i + 1}/${RUNS_PER_ROLE * 2}`);
    
    // Click Run button
    const runButton = await managerPage.$('input[value="Run"]');
    if (runButton) {
      await runButton.click();
      
      // Wait for game to complete
      // Monitor the score or game state
      await managerPage.waitForFunction(() => {
        // Check if game is complete by looking for final scores
        const scoreText = document.body.innerText;
        return scoreText.includes('100') || 
               (scoreText.includes('50') && !scoreText.includes('Control'));
      }, { timeout: 60000 }); // 1 minute timeout per game
      
      // Extract result
      const scores = await managerPage.evaluate(() => {
        const cells = Array.from(document.querySelectorAll('td'));
        const scoreCells = cells.filter(td => /^\d+$/.test(td.textContent.trim()));
        return scoreCells.map(cell => parseInt(cell.textContent.trim()));
      });
      
      console.log('   Scores:', scores);
      
      // Determine winner (assuming first score is X/aero)
      if (scores[0] > scores[1]) {
        results.wins++;
        console.log('   Result: Aero wins! ✅');
      } else if (scores[0] < scores[1]) {
        results.losses++;
        console.log('   Result: Aero loses ❌');
      } else {
        results.draws++;
        console.log('   Result: Draw 🤝');
      }
      
      // Small delay before next game
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  // Summary
  console.log('\n' + '='.repeat(50));
  console.log('🏁 TOURNAMENT COMPLETE');
  console.log('='.repeat(50));
  console.log(`Total Games: ${RUNS_PER_ROLE * 2}`);
  console.log(`Wins: ${results.wins} (${(results.wins / (RUNS_PER_ROLE * 2) * 100).toFixed(1)}%)`);
  console.log(`Draws: ${results.draws} (${(results.draws / (RUNS_PER_ROLE * 2) * 100).toFixed(1)}%)`);
  console.log(`Losses: ${results.losses} (${(results.losses / (RUNS_PER_ROLE * 2) * 100).toFixed(1)}%)`);
  console.log('='.repeat(50));
  
  // Save results
  fs.writeFileSync('tournament_results.json', JSON.stringify({
    game: GAME,
    opponent: OPPONENT,
    totalGames: RUNS_PER_ROLE * 2,
    results: results,
    timestamp: new Date().toISOString()
  }, null, 2));
  console.log('\n💾 Results saved to tournament_results.json');
}

(async () => {
    const browser = await puppeteer.launch({
        headless: false,
        ignoreHTTPSErrors: true,
        args: [
          '--disable-extensions',
          '--disable-features=BlockInsecurePrivateNetworkRequests,UpgradeInsecureRequests',
          '--enable-features=InsecurePrivateNetworkRequestsAllowed' ,
          '--disable-features=UpgradeInsecureRequests',
          '--no-sandbox',  // Helps with stability
          '--disable-setuid-sandbox'  // Helps with stability
        ]
      });

  // Keep browser alive by preventing idle timeout
  const keepAlive = setInterval(() => {
    browser.pages().then(pages => {
      if (pages.length > 0) {
        pages[0].evaluate(() => { /* keep alive */ });
      }
    }).catch(() => {});
  }, 30000); // Every 30 seconds
  
  const page    = await browser.newPage();
  page.setDefaultTimeout(30000);

  // Don't enforce HTTP - let the user handle navigation manually
  try {
    await login(page);
    
    console.log('\n📋 Checking player status...');
    // Skip upload if player already exists
    const uploadNeeded = await checkIfUploadNeeded(page);
    if (uploadNeeded) {
      console.log('📤 Upload needed, proceeding with upload...');
      await uploadPlayer(page);
    } else {
      console.log('✅ Player already uploaded!');
    }
    
    console.log('\n🎮 Proceeding to tournament setup...');
    // Small delay to ensure page is stable
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Open all game windows
    await runTournament(browser, page);
    
    // Keep everything open for interaction
    console.log('\n✅ Tournament complete!');
    console.log('💡 Press Ctrl+C to close all windows.\n');
    
    // Keep the script running
    await new Promise(() => {});
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error('Stack:', error.stack);
    console.log('\n💡 The browser window will stay open for debugging.');
    console.log('Press Ctrl+C to exit when done.');
    
    // Keep the browser open for debugging
    await new Promise(() => {});
  } finally {
    clearInterval(keepAlive);
  }

  await browser.close();
})();

async function checkIfUploadNeeded(page) {
  // Go to profile page to check if player is already uploaded
  const profileUrl = 'http://gamemaster.stanford.edu/homepage/profile.php';
  
  try {
    await page.goto(profileUrl, { waitUntil: 'networkidle2', timeout: 10000 });
  } catch (e) {
    console.log('⚠️  Profile check timeout, assuming upload needed');
    return true;
  }
  
  const pageText = await page.evaluate(() => document.body.innerText);
  const hasPlayer = pageText.includes('Player: aero') || 
                   pageText.toLowerCase().includes('aero');
  
  console.log('🔍 Player check result:', hasPlayer ? 'Player found' : 'Player not found');
  return !hasPlayer;
}
