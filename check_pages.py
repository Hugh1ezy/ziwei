import pdfplumber

pdf_path = 'books/字精成.pdf'
outfile = 'rules/pages_check.txt'

# Find chapter headings by scanning all pages
chapter_pages = []

with pdfplumber.open(pdf_path) as pdf:
    total = len(pdf.pages)
    print(f'Total: {total} pages')

    with open(outfile, 'w', encoding='utf-8') as f:
        f.write(f'Total: {total} pages\n\n')

        for i in range(total):
            text = (pdf.pages[i].extract_text() or '').replace('戍','戌')
            # Look for chapter headers
            if any(kw in text for kw in ['第一章','第二章','第三章','第四章','第五章',
                                          '第六章','第七章','第八章','第九章','第十章',
                                          '第十一章','第十二章','第十三章','第十四章',
                                          '第十五章','附录','下篇','上篇']):
                lines = text.split('\n')
                for line in lines[:5]:
                    if any(kw in line for kw in ['第','章','篇','附录']):
                        f.write(f'PAGE {i+1}: {line.strip()}\n')
                        break

print(f'Done, see {outfile}')
