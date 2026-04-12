import pdfplumber

pdf_path = 'books/字精成.pdf'
outfile = 'rules/vol2toc.txt'

with pdfplumber.open(pdf_path) as pdf:
    with open(outfile, 'w', encoding='utf-8') as f:
        # Lower volume TOC pages 447-455
        f.write('=== LOWER VOLUME TOC (PDF p447-455) ===\n\n')
        for i in range(446, 455):
            text = (pdf.pages[i].extract_text() or '').replace('戍','戌')
            if text.strip():
                f.write(f'--- PDF PAGE {i+1} ---\n')
                f.write(text[:800])
                f.write('\n\n')

        # Also check ch3/4/7 area
        f.write('\n=== CH3-4-7 AREA (PDF p35-50) ===\n\n')
        for i in range(34, 50):
            text = (pdf.pages[i].extract_text() or '').replace('戍','戌')
            if text.strip():
                f.write(f'--- PDF PAGE {i+1} ---\n')
                f.write(text[:400])
                f.write('\n\n')

print('Done')
