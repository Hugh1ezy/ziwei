import pdfplumber

for fname in ['books/字全.pdf', 'books/字全2.pdf', 'books/字全书0.pdf']:
    try:
        with pdfplumber.open(fname) as pdf:
            total = len(pdf.pages)
            # Read first 5 pages
            print(f'\n=== {fname} ({total} pages) ===')
            for i in range(min(8, total)):
                text = (pdf.pages[i].extract_text() or '').replace('戍','戌')
                if text.strip():
                    print(f'--- p{i+1} ---')
                    print(text[:300])
    except Exception as e:
        print(f'{fname}: ERROR {e}')
