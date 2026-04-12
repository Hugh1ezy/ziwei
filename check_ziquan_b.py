import pdfplumber

fname = 'books/字全.pdf'
outfile = 'rules/ziquan_b_sections.txt'

with pdfplumber.open(fname) as pdf:
    total = len(pdf.pages)
    with open(outfile, 'w', encoding='utf-8') as f:
        # Check pages 26-55 for B sections
        for i in range(25, total):
            text = (pdf.pages[i].extract_text() or '').replace('戍','戌')
            if text.strip():
                f.write(f'--- PAGE {i+1} ---\n')
                f.write(text[:600])
                f.write('\n\n')

print(f'Written {outfile}')
