import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, FileText, X, CheckCircle, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useTranslation } from 'react-i18next';
import { api } from '@/lib/serverComm';

interface UploadedFile {
  file: File;
  id: string;
  status: 'uploading' | 'processing' | 'completed' | 'error';
  progress: number;
  error?: string;
}

interface MenuUploadProps {
  onFileUpload?: (files: File[]) => void;
  maxFiles?: number;
  acceptedFileTypes?: Record<string, string[]>;
  isPublicMode?: boolean;
  disabled?: boolean;
}

export function MenuUpload({ 
  onFileUpload, 
  maxFiles = 5, 
  acceptedFileTypes = {
    'application/pdf': ['.pdf'],
    'image/*': ['.png', '.jpg', '.jpeg']
  },
  isPublicMode = false,
  disabled = false
}: MenuUploadProps) {
  const { t } = useTranslation();
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const newFiles: UploadedFile[] = acceptedFiles.map(file => ({
      file,
      id: Math.random().toString(36).substr(2, 9),
      status: 'uploading',
      progress: 0
    }));

    setUploadedFiles(prev => [...prev, ...newFiles]);

    // Start upload process
    newFiles.forEach(fileObj => {
      simulateUpload(fileObj.id, fileObj.file);
    });

    if (onFileUpload) {
      onFileUpload(acceptedFiles);
    }
  }, [onFileUpload]);

  const simulateUpload = async (fileId: string, file: File) => {
    try {
      // First, simulate upload progress
      const interval = setInterval(() => {
        setUploadedFiles(prev => 
          prev.map(fileObj => {
            if (fileObj.id === fileId) {
              const newProgress = Math.min(fileObj.progress + Math.random() * 20, 100);
              const newStatus = newProgress === 100 ? 'processing' : 'uploading';
              return { ...fileObj, progress: newProgress, status: newStatus };
            }
            return fileObj;
          })
        );
      }, 500);

      // Wait for upload to "complete"
      setTimeout(async () => {
        clearInterval(interval);
        
        // Set to processing
        setUploadedFiles(prev => 
          prev.map(fileObj => 
            fileObj.id === fileId ? { ...fileObj, progress: 100, status: 'processing' } : fileObj
          )
        );

        try {
          // Call the actual API
          const result = await api.uploadMenu({
            fileName: fileId,
            originalFileName: file.name,
            fileSize: file.size,
            mimeType: file.type,
          });

          if (result.success) {
            // Poll for completion (in a real app, you might use websockets)
            setTimeout(() => {
              setUploadedFiles(prev => 
                prev.map(fileObj => 
                  fileObj.id === fileId ? { ...fileObj, status: 'completed' } : fileObj
                )
              );
            }, 3000);
          } else {
            setUploadedFiles(prev => 
              prev.map(fileObj => 
                fileObj.id === fileId ? { ...fileObj, status: 'error', error: 'Upload failed' } : fileObj
              )
            );
          }
        } catch (error) {
          console.error('Upload error:', error);
          setUploadedFiles(prev => 
            prev.map(fileObj => 
              fileObj.id === fileId ? { ...fileObj, status: 'error', error: 'Upload failed' } : fileObj
            )
          );
        }
      }, 3000);
    } catch (error) {
      console.error('Upload error:', error);
      setUploadedFiles(prev => 
        prev.map(fileObj => 
          fileObj.id === fileId ? { ...fileObj, status: 'error', error: 'Upload failed' } : fileObj
        )
      );
    }
  };

  const removeFile = (fileId: string) => {
    setUploadedFiles(prev => prev.filter(file => file.id !== fileId));
  };

  const { getRootProps, getInputProps, isDragActive, fileRejections } = useDropzone({
    onDrop,
    accept: acceptedFileTypes,
    maxFiles,
    disabled: disabled || uploadedFiles.length >= maxFiles
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'error':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      default:
        return <FileText className="h-4 w-4 text-blue-500" />;
    }
  };



  return (
    <div className="w-full max-w-2xl mx-auto space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>{t('menuUpload.title', 'Upload Your Menu')}</CardTitle>
          <CardDescription>
            {isPublicMode 
              ? t('menuUpload.publicDescription', 'Upload PDF files or images of your restaurant menu for free analysis. No signup required!')
              : t('menuUpload.description', 'Upload PDF files or images of your restaurant menu for analysis')
            }
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div
            {...getRootProps()}
            className={`
              border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors
              ${isDragActive 
                ? 'border-primary bg-primary/5' 
                : 'border-gray-300 hover:border-primary/50'
              }
              ${uploadedFiles.length >= maxFiles ? 'opacity-50 cursor-not-allowed' : ''}
            `}
          >
            <input {...getInputProps()} />
            <Upload className="h-12 w-12 mx-auto mb-4 text-gray-400" />
            
            {isDragActive ? (
              <p className="text-primary font-medium">
                {t('menuUpload.dropHere', 'Drop your files here...')}
              </p>
            ) : (
              <div>
                <p className="text-gray-600 mb-2">
                  {uploadedFiles.length >= maxFiles 
                    ? t('menuUpload.maxFilesReached', `Maximum ${maxFiles} files reached`)
                    : t('menuUpload.dragDrop', 'Drag and drop your menu files here, or click to browse')
                  }
                </p>
                <p className="text-sm text-gray-500">
                  {t('menuUpload.supportedFormats', 'Supported formats: PDF, PNG, JPG, JPEG')}
                </p>
              </div>
            )}
          </div>

          {fileRejections.length > 0 && (
            <div className="mt-4">
              {fileRejections.map(({ file, errors }) => (
                <Alert key={file.name} className="mb-2">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    {file.name}: {errors.map(e => e.message).join(', ')}
                  </AlertDescription>
                </Alert>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {uploadedFiles.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>{t('menuUpload.uploadProgress', 'Upload Progress')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {uploadedFiles.map((fileObj) => (
              <div key={fileObj.id} className="flex items-center space-x-4 p-3 border rounded-lg">
                {getStatusIcon(fileObj.status)}
                
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{fileObj.file.name}</p>
                  <div className="flex items-center space-x-2 mt-1">
                    <Progress 
                      value={fileObj.progress} 
                      className="flex-1"
                    />
                    <span className="text-xs text-gray-500 min-w-0">
                      {Math.round(fileObj.progress)}%
                    </span>
                  </div>
                  {fileObj.status === 'processing' && (
                    <p className="text-xs text-yellow-600 mt-1">
                      {t('menuUpload.processing', 'Processing menu...')}
                    </p>
                  )}
                  {fileObj.status === 'completed' && (
                    <p className="text-xs text-green-600 mt-1">
                      {t('menuUpload.completed', 'Analysis completed')}
                    </p>
                  )}
                </div>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeFile(fileObj.id)}
                  className="flex-shrink-0"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}