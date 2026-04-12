import pdfplumber

# Check 字全.pdf more thoroughly
fname = 'books/字全.pdf'
outfile = 'rules/ziquan_toc.txt'

with pdfplumber.open(fname) as pdf:
    total = len(pdf.pages)
    with open(outfile, 'w', encoding='utf-8') as f:
        f.write(f'=== {fname} ({total} pages) ===\n\n')
        for i in range(total):
            text = (pdf.pages[i].extract_text() or '').replace('戍','戌')
            if text.strip():
                f.write(f'--- PAGE {i+1} ---\n')
                f.write(text[:800])
                f.write('\n\n')

print(f'Written {outfile}')
