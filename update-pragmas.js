const fs = require('fs');
const path = require('path');

function walk(dir) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(function(file) {
        file = dir + '/' + file;
        const stat = fs.statSync(file);
        if (stat && stat.isDirectory()) { 
            results = results.concat(walk(file));
        } else { 
            if (file.endsWith('.sol')) results.push(file);
        }
    });
    return results;
}

const files = walk('./contracts');
files.forEach(file => {
    let content = fs.readFileSync(file, 'utf8');
    if (content.includes('pragma solidity 0.8.20;')) {
        content = content.replace('pragma solidity 0.8.20;', 'pragma solidity ^0.8.20;');
        fs.writeFileSync(file, content, 'utf8');
        console.log(`Updated ${file}`);
    }
});
