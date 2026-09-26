const fs = require('fs');
const path = require('path');

const pagesDir = path.join(__dirname, 'src', 'pages');
const files = fs.readdirSync(pagesDir).filter(f => f.endsWith('.tsx'));

for (const file of files) {
  const filePath = path.join(pagesDir, file);
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;

  if (content.includes('arrow_back_ios') || content.includes('chevron_left')) {
    // Check if we need to add useNavigate
    if (!content.includes('useNavigate')) {
      if (content.includes('import { Link }')) {
        content = content.replace("import { Link }", "import { Link, useNavigate }");
      } else if (content.includes('import { Link, useParams }')) {
        content = content.replace("import { Link, useParams }", "import { Link, useParams, useNavigate }");
      } else if (content.includes('import { Link, useLocation }')) {
        content = content.replace("import { Link, useLocation }", "import { Link, useLocation, useNavigate }");
      } else {
        content = content.replace("import { Link", "import { Link, useNavigate");
      }
      modified = true;
    }

    // Add const navigate = useNavigate();
    if (!content.includes('const navigate = useNavigate();')) {
      const functionMatch = content.match(/export default function \w+\(\) \{/);
      if (functionMatch) {
        content = content.replace(functionMatch[0], `${functionMatch[0]}\n  const navigate = useNavigate();`);
        modified = true;
      }
    }

    // Replace Link with button for arrow_back_ios
    const linkRegex = /<Link to="[^"]*" className="([^"]*)">\s*<span className="material-symbols-outlined">arrow_back_ios<\/span>\s*<\/Link>/g;
    if (linkRegex.test(content)) {
      content = content.replace(linkRegex, '<button onClick={() => navigate(-1)} className="$1">\n          <span className="material-symbols-outlined">arrow_back_ios</span>\n        </button>');
      modified = true;
    }

    // Replace specific chevron_left in LotteryBet.tsx
    if (file === 'LotteryBet.tsx') {
      const chevronRegex = /<Link to="\/" className="flex items-center gap-2">\s*<span className="material-symbols-outlined text-\[var\(--navy-deep\)\] text-sm">chevron_left<\/span>\s*<span className="text-sm font-bold text-\[var\(--navy-deep\)\]">หน้าแรกหวย<\/span>\s*<\/Link>/g;
      if (chevronRegex.test(content)) {
        content = content.replace(chevronRegex, '<button onClick={() => navigate(-1)} className="flex items-center gap-2">\n            <span className="material-symbols-outlined text-[var(--navy-deep)] text-sm">chevron_left</span>\n            <span className="text-sm font-bold text-[var(--navy-deep)]">หน้าแรกหวย</span>\n          </button>');
        modified = true;
      }
    }
  }

  if (modified) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Updated ${file}`);
  }
}
