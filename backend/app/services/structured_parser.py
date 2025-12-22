"""
Structured Data Parser for Generative UI

Parses AI responses to detect structured data patterns and convert them
to JSON format for rendering as charts, tables, cards, etc.

Patterns detected:
- Tables (markdown or structured text)
- Lists with numbers/data (for charts)
- Key-value pairs (for cards)
- JSON blocks (direct structured data)
"""

import re
import json
from typing import Dict, List, Any, Optional, Tuple


class StructuredDataParser:
    """
    Parses AI text responses to extract structured data for generative UI.
    
    Can detect:
    - Data tables → table component
    - Numerical lists → chart data
    - Statistics/metrics → card component
    - JSON blocks → direct rendering
    """
    
    @staticmethod
    def parse(text: str) -> Tuple[str, List[Dict[str, Any]]]:
        """
        Parse text to extract ALL structured data patterns.
        
        Args:
            text: The AI response text
            
        Returns:
            Tuple of (cleaned_text, list_of_structured_data)
            list is empty if no patterns found
            
        Example:
            text, items = parser.parse(response)
            # items = [{"type": "chart", "data": [...], "config": {...}}, ...]
        """
        print(f"\\nParsing text (length: {len(text)})")
        
        structured_items = []
        cleaned_text = text
        
        # Split by markdown headers to find distinct sections with their titles
        # This separates "**Stars** data... **Market Share** data..." into multiple charts
        header_pattern = r'(\*\*([^*]+)\*\*)\s*\n([^\*]+?)(?=\n\s*\n|\*\*|$)'
        header_matches = re.finditer(header_pattern, text, re.DOTALL)
        
        all_charts = []
        for match in header_matches:
            title = match.group(2).strip()  # Extract title from **Title**
            section_content = match.group(3).strip()  # Get content after header
            
            if not section_content:
                continue
                
            chart_match = StructuredDataParser._extract_chart_data(section_content)
            if chart_match:
                _, chart_data = chart_match
                # Use the extracted title from the header
                chart_data['config']['title'] = title
                all_charts.append(chart_data)
                print(f"✓ Found chart: {title}")
        
        if all_charts:
            structured_items.extend(all_charts)
            print(f"✓ Found {len(all_charts)} chart(s)")
        
        # Extract all table patterns
        table_match = StructuredDataParser._extract_table_data(cleaned_text)
        if table_match:
            cleaned_text, table_data = table_match
            structured_items.append(table_data)
            print(f"✓ Found table data")
        
        # Extract all card patterns
        card_match = StructuredDataParser._extract_card_data(cleaned_text)
        if card_match:
            cleaned_text, card_data = card_match
            structured_items.append(card_data)
            print(f"✓ Found card data")
        
        print(f"Total structured items found: {len(structured_items)}")
        return cleaned_text, structured_items
    
    @staticmethod
    def _extract_json_block(text: str) -> Optional[Tuple[str, Dict[str, Any]]]:
        """Extract JSON blocks marked with ```json or ```generative-ui"""
        pattern = r'```(?:json|generative-ui)\s*(.*?)\s*```'
        match = re.search(pattern, text, re.DOTALL | re.IGNORECASE)
        
        if match:
            try:
                json_str = match.group(1)
                data = json.loads(json_str)
                
                # Validate it has the expected structure
                if 'type' in data and 'data' in data:
                    # Fix data format if it's strings like "React: 220135"
                    if isinstance(data['data'], list) and len(data['data']) > 0:
                        if isinstance(data['data'][0], str) and ':' in data['data'][0]:
                            # Convert "React: 220135" to {"name": "React", "value": 220135}
                            fixed_data = []
                            for item in data['data']:
                                parts = item.split(':', 1)
                                if len(parts) == 2:
                                    try:
                                        fixed_data.append({
                                            "name": parts[0].strip(),
                                            "value": float(parts[1].strip().replace(',', ''))
                                        })
                                    except ValueError:
                                        pass
                            if fixed_data:
                                data['data'] = fixed_data
                    
                    cleaned_text = text[:match.start()] + text[match.end():]
                    return cleaned_text.strip(), data
            except json.JSONDecodeError:
                pass
        
        return None
    
    @staticmethod
    def _extract_chart_data(text: str) -> Optional[Tuple[str, Dict[str, Any]]]:
        """
        Detect patterns like:
        - 2020: 100
        - 2021: 150
        - 2022: 200
        
        Or numbered lists with data
        Also handles inline format: "React Stars: 220200 Vue Stars: 208400"
        Handles units: "180K", "45%", etc.
        """
        # Pattern that captures name, value, and optional unit (K, M, %, etc.)
        # Matches: "TensorFlow Stars: 180K" or "TensorFlow: 45%"
        pattern = r'^[\-\*]?\s*(.+?):\s*(\d+(?:\.\d+)?)\s*([KMB%]?)\s*$'
        matches = re.findall(pattern, text, re.MULTILINE)
        
        # If no multiline matches, try inline pattern
        if len(matches) < 3:
            inline_pattern = r'(\w+(?:\s+\w+)*?)\s*:\s*(\d+(?:\.\d+)?)\s*([KMB%]?)'
            inline_matches = re.findall(inline_pattern, text)
            if len(inline_matches) >= 3:
                matches = inline_matches
        
        if len(matches) >= 3:  # Need at least 3 data points
            chart_data = []
            for name, value, unit in matches:
                # Convert K, M, B to actual numbers
                num_value = float(value)
                if unit.upper() == 'K':
                    num_value *= 1000
                elif unit.upper() == 'M':
                    num_value *= 1000000
                elif unit.upper() == 'B':
                    num_value *= 1000000000
                
                chart_data.append({
                    "name": name.strip(),
                    "value": num_value
                })
            
            # Remove the matched lines from text
            cleaned_text = text
            for name, value, unit in matches:
                pattern_to_remove = rf'^[\-\*]?\s*{re.escape(name)}:\s*{re.escape(value)}\s*{re.escape(unit)}\s*$'
                cleaned_text = re.sub(pattern_to_remove, '', cleaned_text, flags=re.MULTILINE)
            
            return cleaned_text.strip(), {
                "type": "chart",
                "data": chart_data,
                "config": {
                    "type": "bar",
                    "xKey": "name",
                    "yKey": "value",
                    "title": "Data Comparison"
                }
            }
        
        return None
    
    @staticmethod
    def _extract_table_data(text: str) -> Optional[Tuple[str, Dict[str, Any]]]:
        """
        Detect markdown tables or structured tabular data.
        
        Example:
        | Name | Age | City |
        |------|-----|------|
        | John | 30  | NYC  |
        """
        # Simple markdown table detection
        lines = text.split('\n')
        table_lines = []
        in_table = False
        
        for line in lines:
            if '|' in line and line.strip().startswith('|'):
                in_table = True
                table_lines.append(line)
            elif in_table and not line.strip():
                break
        
        if len(table_lines) >= 3:  # Header + separator + at least one row
            try:
                # Parse table
                rows = [
                    [cell.strip() for cell in line.split('|')[1:-1]]
                    for line in table_lines
                ]
                
                # Skip separator row (usually has dashes)
                headers = rows[0]
                data_rows = [row for row in rows[2:] if not all('-' in cell for cell in row)]
                
                # Convert to dict list
                table_data = [
                    {headers[i]: row[i] for i in range(len(headers))}
                    for row in data_rows
                ]
                
                if table_data:
                    # Remove table from text
                    table_text = '\n'.join(table_lines)
                    cleaned_text = text.replace(table_text, '').strip()
                    
                    return cleaned_text, {
                        "type": "table",
                        "data": table_data
                    }
            except Exception:
                pass
        
        return None
    
    @staticmethod
    def _extract_card_data(text: str) -> Optional[Tuple[str, Dict[str, Any]]]:
        """
        Detect key-value patterns for metric cards.
        
        Example:
        Total: 1000
        Average: 50
        Maximum: 200
        
        Or with citations:
        Market Size [1]: USD 3.6 million
        Growth Rate [2]: 44.8%
        """
        # Pattern: Word followed by optional [citation] then colon and value
        # More flexible - matches "Market Size [1]:" or just "Total:"
        pattern = r'^([A-Z][A-Za-z\s]+?)(?:\s*\[\d+\])?\s*:\s*(.+?)\s*$'
        matches = re.findall(pattern, text, re.MULTILINE)
        
        if len(matches) >= 2:  # Need at least 2 metrics
            card_data = {
                name.strip(): value.strip()
                for name, value in matches
            }
            
            # Remove the matched lines
            cleaned_text = text
            for name, value in matches:
                # Match with or without citation
                cleaned_text = re.sub(
                    rf'^{re.escape(name)}(?:\s*\[\d+\])?\s*:\s*{re.escape(value)}\s*$',
                    '',
                    cleaned_text,
                    flags=re.MULTILINE
                )
            
            return cleaned_text.strip(), {
                "type": "card",
                "data": card_data
            }
        
        return None


def add_generative_ui_instruction(prompt: str) -> str:
    """
    Enhance prompt to encourage AI to generate structured data.
    
    This can be added to system prompts or user prompts to guide
    the AI to produce data in formats that can be visualized.
    """
    instruction = """

IMPORTANT - Data Visualization Format:
When your response includes numerical data, comparisons, or statistics, format them as follows:

FOR CHARTS (comparisons, trends, distributions):
Present data like this:
2020: 100
2021: 150
2022: 200
(Each line: Label: Number)

FOR METRICS/STATISTICS:
Present like this:
Total Users: 1000
Average Score: 85
Success Rate: 95%
(Capitalize first letter of each metric name)

FOR TABLES:
Use markdown tables for structured data.

These formats will be automatically visualized as interactive charts and metric cards.
"""
    return prompt + instruction
