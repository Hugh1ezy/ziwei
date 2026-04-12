import pdfplumber
import sys

pdf_path = 'books/字精成.pdf'
outfile = 'rules/toc_check.txt'

with pdfplumber.open(pdf_path) as pdf:
    total = len(pdf.pages)
    with open(outfile, 'w', encoding='utf-8') as f:
        f.write(f'Total pages: {total}\n\n')
        # Check first 20 pages for TOC
        for i in range(min(20, total)):
            text = (pdf.pages[i].extract_text() or '').replace('戍', '戌')
            if text.strip():
                f.write(f'--- PAGE {i+1} ---\n')
                f.write(text[:600])
                f.write('\n\n')
        # Also check around page 450-460 for vol2 start
        f.write('\n\n=== CHECKING PAGES 440-465 FOR VOL2 START ===\n\n')
        for i in range(440, min(465, total)):
            text = (pdf.pages[i].extract_text() or '').replace('戍', '戌')
            if text.strip():
                f.write(f'--- PAGE {i+1} ---\n')
                f.write(text[:400])
                f.write('\n\n')

print(f'Written to {outfile}')
