"""Extract all remaining chapters from 字精成.pdf as raw text"""
import pdfplumber

pdf_path = 'books/字精成.pdf'

ranges = {
    'ch1_7':    (7,   99),   # PDF pages 8-99  (indices 7-98)
    'ch10_12': (453, 530),  # PDF pages 454-530 (indices 453-529)
    'ch13_14': (530, 656),  # PDF pages 531-656 (indices 530-655)
    'ch15_app':(656, 704),  # PDF pages 657-704 (indices 656-703)
}

with pdfplumber.open(pdf_path) as pdf:
    total = len(pdf.pages)
    print(f'Total pages: {total}')

    for name, (start, end) in ranges.items():
        out = f'rules/{name}_raw.txt'
        raw = ''
        for i in range(start, min(end, total)):
            text = (pdf.pages[i].extract_text() or '').replace('戍', '戌')
            raw += f'\n[PAGE{i+1}]\n{text}'

        with open(out, 'w', encoding='utf-8') as f:
            f.write(raw)
        print(f'  Saved {out}: {len(raw):,} chars ({end-start} pages)')

print('All done!')
