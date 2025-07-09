// Type definitions for browser-specific APIs used in SimpleConfigDiff

declare global {
  interface File {
    readonly webkitRelativePath: string;
  }
  
  interface FileSystemEntry {
    readonly isFile: boolean;
    readonly isDirectory: boolean;
    readonly name: string;
    readonly fullPath: string;
  }
  
  interface FileSystemFileEntry extends FileSystemEntry {
    readonly isFile: true;
    readonly isDirectory: false;
    file(successCallback: (file: File) => void, errorCallback?: (error: Error) => void): void;
  }
  
  interface FileSystemDirectoryEntry extends FileSystemEntry {
    readonly isFile: false;
    readonly isDirectory: true;
    createReader(): FileSystemDirectoryReader;
  }
  
  interface FileSystemDirectoryReader {
    readEntries(successCallback: (entries: FileSystemEntry[]) => void, errorCallback?: (error: Error) => void): void;
  }
  
  interface DataTransferItem {
    webkitGetAsEntry(): FileSystemEntry | null;
  }
}

export {};
