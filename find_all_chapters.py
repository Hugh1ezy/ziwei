import pdfplumber

pdf_path = 'books/字精成.pdf'
with pdfplumber.open(pdf_path) as pdf:
    print(f'Total: {len(pdf.pages)} pages')
    for i in range(len(pdf.pages)):
        text = (pdf.pages[i].extract_text() or '').replace('戍','戌')
        for ch in ['第十二章','第十三章','第十四章','第十五章']:
            if ch in text:
                # Find the line
                for line in text.split('\n'):
                    if ch in line:
                        print(f'PDF p{i+1}: {line.strip()[:80]}')
                        break
                break
