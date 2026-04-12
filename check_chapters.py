import pdfplumber

pdf_path = 'books/字精成.pdf'
outfile = 'rules/chapters_detail.txt'

with pdfplumber.open(pdf_path) as pdf:
    total = len(pdf.pages)
    with open(outfile, 'w', encoding='utf-8') as f:
        f.write(f'Total: {total} pages\n\n')

        # Check pages around ch3-7 (PDF ~36-100)
        f.write('=== CH3-7 AREA (PDF pages 36-100) ===\n')
        for i in range(35, 100):
            text = (pdf.pages[i].extract_text() or '').replace('戍','戌')
            lines = text.split('\n')
            for line in lines[:3]:
                if line.strip() and ('第' in line and '章' in line or '节' in line and len(line) < 30):
                    f.write(f'p{i+1}: {line.strip()}\n')
                    break

        # Check pages for ch11, 12, 13, 14, 15
        f.write('\n=== CH10-15 AREA (PDF pages 505-660) ===\n')
        for i in range(505, 660):
            text = (pdf.pages[i].extract_text() or '').replace('戍','戌')
            lines = text.split('\n')
            for line in lines[:3]:
                if line.strip() and '章' in line and '第' in line:
                    f.write(f'p{i+1}: {line.strip()}\n')
                    break

        # Sample pages 508-535 to find ch11/12/13 boundary
        f.write('\n=== CH11-13 SAMPLES ===\n')
        for i in [507, 508, 509, 519, 529, 530, 531, 532]:
            text = (pdf.pages[i].extract_text() or '').replace('戍','戌')
            f.write(f'p{i+1}: {text[:120].strip()}\n\n')

        # Sample around ch15 and appendix
        f.write('\n=== CH15 AND APPENDIX SAMPLES ===\n')
        for i in [655, 656, 657, 685, 686, 687, 688]:
            text = (pdf.pages[i].extract_text() or '').replace('戍','戌')
            f.write(f'p{i+1}: {text[:120].strip()}\n\n')

print('Done')
