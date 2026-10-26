const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, 'customer-app', 'src', 'screens');

function processFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  if (content.includes('Alert.alert(') || content.includes('Alert,')) {
    // replace `Alert,` with empty if it's in a destructured import
    content = content.replace(/Alert,\n/g, '');
    content = content.replace(/Alert,/g, '');
    
    // add import
    if (!content.includes("import { showAlert }")) {
      content = content.replace(/import React/, "import { showAlert } from '../store/alert';\nimport React");
    }
    
    // replace calls
    content = content.replace(/Alert\.alert\(/g, 'showAlert(');
    
    fs.writeFileSync(filePath, content);
    console.log(`Updated ${path.basename(filePath)}`);
  }
}

const files = fs.readdirSync(srcDir).filter(f => f.endsWith('.tsx') || f.endsWith('.ts'));
files.forEach(f => processFile(path.join(srcDir, f)));
