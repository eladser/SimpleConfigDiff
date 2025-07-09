import { XMLParser } from 'fast-xml-parser';
import { ParsedConfig } from '@/types';

export function parseXML(content: string): ParsedConfig {
  try {
    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '@_',
      textNodeName: '#text',
      ignoreDeclaration: true,
      ignoreNameSpace: false,
      parseAttributeValue: true,
      parseTagValue: true,
      arrayMode: false,
      trimValues: true,
      cdataTagName: '__cdata',
      cdataPositionChar: '\\c',
      parseTrueNumberOnly: false,
      isArray: (name, jpath, isLeafNode, isAttribute) => {
        // Handle common XML arrays
        if (name === 'item' || name === 'entry' || name === 'element') {
          return true;
        }
        return false;
      }
    });

    const data = parser.parse(content);
    
    // If there's a single root element, extract it
    const keys = Object.keys(data);
    if (keys.length === 1) {
      const rootKey = keys[0];
      const rootValue = data[rootKey];
      
      // If root has both attributes and text/children, keep the structure
      if (typeof rootValue === 'object' && rootValue !== null) {
        return {
          data: { [rootKey]: rootValue },
          format: 'xml'
        };
      }
    }
    
    return {
      data,
      format: 'xml'
    };
  } catch (error) {
    throw new Error(`Invalid XML: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}