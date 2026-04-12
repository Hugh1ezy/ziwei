import pdfplumber

pdf_path = 'books/字精成.pdf'
outfile = 'rules/ch14_find.txt'

with pdfplumber.open(pdf_path) as pdf:
    with open(outfile, 'w', encoding='utf-8') as f:
        # Check pages 540-660 for ch14
        for i in range(540, 660):
            text = (pdf.pages[i].extract_text() or '').replace('戍','戌')
            if text.strip():
                first_lines = '\n'.join(text.split('\n')[:3])
                if '第十四章' in first_lines:
                    f.write(f'CH14 FOUND at PDF p{i+1}:\n{first_lines}\n\n')
                elif '第十五章' in first_lines:
                    f.write(f'CH15 FOUND at PDF p{i+1}:\n{first_lines}\n\n')
                    break

        # Also sample pages 590-660
        f.write('\n=== SAMPLES 590-660 ===\n')
        for i in range(589, 660, 5):
            text = (pdf.pages[i].extract_text() or '').replace('戍','戌')
            f.write(f'p{i+1}: {text[:80].strip()}\n')

print('Done')
