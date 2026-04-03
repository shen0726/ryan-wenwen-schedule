const fs = require('fs');
const path = require('path');

// Check if sharp is installed, if not use canvas API via puppeteer or fallback
async function generateIcons() {
  const sharp = require('sharp');

  const sizes = [72, 96, 128, 144, 152, 192, 384, 512];
  const inputImage = process.argv[2] || 'app-icon.png';

  if (!fs.existsSync(inputImage)) {
    console.error(`Error: ${inputImage} not found!`);
    console.log('Usage: node generate-icons.js <path-to-image>');
    console.log('Or place an image named "app-icon.png" in the project root.');
    process.exit(1);
  }

  const iconsDir = path.join(__dirname, 'public', 'icons');

  console.log(`Generating icons from: ${inputImage}`);

  for (const size of sizes) {
    const outputPath = path.join(iconsDir, `icon-${size}x${size}.png`);

    await sharp(inputImage)
      .resize(size, size, { fit: 'cover', position: 'center' })
      .png()
      .toFile(outputPath);

    console.log(`✓ Generated ${size}x${size}`);
  }

  console.log('\nAll icons generated successfully!');
  console.log(`Location: ${iconsDir}`);
}

generateIcons().catch(err => {
  console.error('Error generating icons:', err.message);
  process.exit(1);
});
