import pdfplumber

pdf_path = 'books/字精成.pdf'
outfile = 'rules/ch12_14_find.txt'

with pdfplumber.open(pdf_path) as pdf:
    with open(outfile, 'w', encoding='utf-8') as f:
        # Check around PDF 514 for ch12 and PDF 535 for ch14
        for i in range(510, 560):
            text = (pdf.pages[i].extract_text() or '').replace('戍','戌')
            if text.strip():
                first_lines = '\n'.join(text.split('\n')[:4])
                if any(kw in first_lines for kw in ['第十二章','第十三章','第十四章','第十五章']):
                    f.write(f'CHAPTER FOUND at PDF p{i+1}:\n{first_lines}\n\n')
                # Show page number to track
                if i in range(510, 560):
                    f.write(f'p{i+1}: {text[:80].strip()}\n')

print('Done')
