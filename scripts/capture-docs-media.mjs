#!/usr/bin/env node
/**
 * docs:capture — Playwright + ffmpeg media capture pipeline
 * 
 * Walks media-manifest.json items[].capture, drives the studio at PUBLIC_APP_URL
 * through Playwright, and writes public/media/<id>.png (screenshot) or <id>.gif (gif).
 * Runs for both FR and EN locales (16 scenarios × 2 locales = 32 captures).
 * 
 * Usage:
 *   PUBLIC_APP_URL=http://localhost:4173 node scripts/capture-docs-media.mjs
 *   PUBLIC_APP_URL=https://rdm-studio-app.vercel.app node scripts/capture-docs-media.mjs
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execa } from 'execa';
import { chromium, firefox } from 'playwright';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

const MANIFEST_PATH = path.join(ROOT, 'apps/docs/media-manifest.json');
const OUTPUT_DIR = path.join(ROOT, 'apps/docs/public/media');
const LOCALES = ['en', 'fr'];
const VIEWPORTS = {
  desktop: { width: 1440, height: 900 },
  mobile: { width: 390, height: 844 }
};

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runCapture() {
  const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf-8'));
  const appUrl = process.env.PUBLIC_APP_URL;
  
  if (!appUrl) {
    console.error('❌ PUBLIC_APP_URL environment variable is required');
    console.error('   Example: PUBLIC_APP_URL=http://localhost:4173 node scripts/capture-docs-media.mjs');
    process.exit(1);
  }

  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  const items = manifest.items.filter(item => item.capture);
  console.log(`📋 Found ${items.length} media items with capture instructions`);
  console.log(`🌐 Target URL: ${appUrl}`);
  console.log(`📁 Output directory: ${OUTPUT_DIR}`);
  console.log(`🌍 Locales: ${LOCALES.join(', ')}`);
  console.log('');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: VIEWPORTS.desktop,
    locale: 'en-US',
    colorScheme: 'light'
  });

  let successCount = 0;
  let failCount = 0;

  for (const locale of LOCALES) {
    console.log(`\n🌍 Processing locale: ${locale}`);
    
    for (const item of items) {
      const id = item.id;
      const outputPath = path.join(OUTPUT_DIR, `${id}-${locale}.${item.type === 'gif' ? 'gif' : 'png'}`);
      
      console.log(`  📸 Capturing ${id} (${item.type})...`);
      
      try {
        const page = await context.newPage();
        
        // Set locale via URL parameter or localStorage
        const url = `${appUrl}/${locale}${item.capture.route}`;
        await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
        
        // Wait for the persistent stage to be ready
        if (item.capture.wait) {
          await page.waitForSelector(item.capture.wait, { timeout: 15000 });
        }
        
        // Execute custom actions if specified
        if (item.capture.actions) {
          const actions = item.capture.actions;
          
          // Parse and execute actions
          if (actions.includes('click')) {
            const match = actions.match(/click\s+'([^']+)'/);
            if (match) {
              await page.click(`text=${match[1]}`);
              await sleep(500);
            }
          }
          
          if (actions.includes('open Loads step')) {
            await page.click('text=Charges, text=Loads');
            await sleep(500);
          }
          
          if (actions.includes('expand Générateurs')) {
            await page.click('text=Générateurs');
            await sleep(500);
          }
          
          if (actions.includes('select Vent') || actions.includes('select Wind')) {
            await page.click('text=Vent, text=Wind');
            await sleep(500);
          }
          
          if (actions.includes('select Sismique') || actions.includes('select Seismic')) {
            await page.click('text=Sismique, text=Seismic');
            await sleep(500);
          }
          
          if (actions.includes('open Modal panel')) {
            await page.click('text=Modal');
            await sleep(500);
          }
          
          if (actions.includes('open Flambement panel')) {
            await page.click('text=Flambement, text=Buckling');
            await sleep(500);
          }
          
          if (actions.includes('open Calcul step')) {
            await page.click('text=Calcul, text=Results');
            await sleep(500);
          }
          
          if (actions.includes('open EC3 verification panel')) {
            await page.click('text=EC3');
            await sleep(500);
          }
          
          if (actions.includes('set (0, 0.4, 1.3)')) {
            // Fill acceleration field inputs
            await page.fill('input[placeholder*="ax"], input[placeholder*="ay"], input[placeholder*="az"]', '0, 0.4, 1.3');
            await sleep(500);
          }
          
          if (actions.includes('wait 1200 ms')) {
            await sleep(1200);
          }
          
          if (actions.includes('screenshot 3 frames')) {
            // For GIF capture - take multiple frames
            const frames = [];
            for (let i = 0; i < 3; i++) {
              const frameBuffer = await page.screenshot({ type: 'png' });
              frames.push(frameBuffer);
              await sleep(400);
            }
            
            // Write frames as individual PNGs for ffmpeg
            const frameDir = path.join(OUTPUT_DIR, `frames-${id}`);
            if (!fs.existsSync(frameDir)) fs.mkdirSync(frameDir, { recursive: true });
            
            for (let i = 0; i < frames.length; i++) {
              fs.writeFileSync(path.join(frameDir, `frame-${i}.png`), frames[i]);
            }
            
            // Generate GIF with ffmpeg
            await execa('ffmpeg', [
              '-y', '-framerate', '2.5', '-i', path.join(frameDir, 'frame-%d.png'),
              '-vf', 'palettegen', path.join(frameDir, 'palette.png')
            ]);
            
            await execa('ffmpeg', [
              '-y', '-framerate', '2.5', '-i', path.join(frameDir, 'frame-%d.png'),
              '-i', path.join(frameDir, 'palette.png'),
              '-lavfi', 'paletteuse', outputPath
            ]);
            
            // Cleanup
            fs.rmSync(frameDir, { recursive: true, force: true });
            
            console.log(`    ✅ GIF saved: ${outputPath}`);
            await page.close();
            successCount++;
            continue;
          }
        }
        
        // Standard screenshot capture
        await sleep(500); // Let any animations settle
        
        if (item.capture.viewport) {
          await page.setViewportSize({ 
            width: item.capture.viewport[0], 
            height: item.capture.viewport[1] 
          });
          await sleep(300);
        }
        
        await page.screenshot({ path: outputPath, type: item.type === 'gif' ? 'png' : 'png', fullPage: false });
        console.log(`    ✅ Screenshot saved: ${outputPath}`);
        await page.close();
        successCount++;
        
      } catch (error) {
        console.error(`    ❌ Failed to capture ${id}: ${error.message}`);
        failCount++;
      }
    }
  }

  await browser.close();
  
  console.log('\n📊 Capture Summary:');
  console.log(`   ✅ Successful: ${successCount}`);
  console.log(`   ❌ Failed: ${failCount}`);
  console.log(`   📁 Output: ${OUTPUT_DIR}`);
  
  if (failCount > 0) {
    process.exit(1);
  }
}

runCapture().catch(err => {
  console.error('💥 Fatal error:', err);
  process.exit(1);
});