const fs = require('fs');
const path = require('path');

function processDir(dir, importPath) {
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.tsx') || f.endsWith('.ts'));
  
  for (const f of files) {
    const filePath = path.join(dir, f);
    let content = fs.readFileSync(filePath, 'utf8');
    
    if (!content.includes('SafeAreaView')) continue;
    
    let changed = false;
    
    // Replace <SafeAreaView with <SafeScreen and </SafeAreaView> with </SafeScreen>
    if (content.includes('<SafeAreaView')) {
      content = content.replace(/<SafeAreaView/g, '<SafeScreen');
      content = content.replace(/<\/SafeAreaView>/g, '</SafeScreen>');
      changed = true;
    }
    
    if (changed) {
      // Remove SafeAreaView from react-native imports
      // Handle "  SafeAreaView,\n" pattern
      content = content.replace(/\s*SafeAreaView,?\n/g, (match) => {
        // If it's the only thing on the line, remove the line
        return '\n';
      });
      
      // Clean up any double newlines from removal
      content = content.replace(/\n\n\n/g, '\n\n');
      
      // Add SafeScreen import if not already there
      if (!content.includes("import { SafeScreen }")) {
        content = `import { SafeScreen } from '${importPath}';\n` + content;
      }
      
      fs.writeFileSync(filePath, content);
      console.log(`Updated ${f}`);
    }
  }
}

// Customer app screens
processDir(
  path.join(__dirname, 'customer-app', 'src', 'screens'),
  '../components/SafeScreen'
);

// Workers app screens  
processDir(
  path.join(__dirname, 'workers-app', 'src', 'screens'),
  '../components/SafeScreen'
);

console.log('Done!');
