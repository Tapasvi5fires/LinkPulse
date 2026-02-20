import re
import html
from typing import List

class DataCleaner:
    def clean_text(self, text: str, is_code: bool = False) -> str:
        """
        Clean and normalize text.
        For code content, preserve structure (newlines, indentation).
        """
        if not text:
            return ""
        
        # Decode HTML entities
        text = html.unescape(text)
        
        # Remove HTML tags (if any remained from trafilatura)
        text = re.sub(r'<[^>]+>', '', text)
        
        if is_code:
            # For code: preserve newlines and indentation, just strip trailing whitespace per line
            lines = text.split('\n')
            cleaned_lines = [line.rstrip() for line in lines]
            # Remove excessive blank lines (more than 2 consecutive)
            result = []
            blank_count = 0
            for line in cleaned_lines:
                if line.strip() == '':
                    blank_count += 1
                    if blank_count <= 2:
                        result.append(line)
                else:
                    blank_count = 0
                    result.append(line)
            text = '\n'.join(result).strip()
        else:
            # For prose/documents: standardize whitespace
            text = re.sub(r'\s+', ' ', text).strip()
        
        return text

    def clean_batch(self, texts: List[str], is_code: bool = False) -> List[str]:
        return [self.clean_text(t, is_code=is_code) for t in texts]

data_cleaner = DataCleaner()
