'use client';

import React, { useState } from 'react';

interface SimpleResumePreviewProps {
  imageUrl: string;
  onViewPdf: () => void;
  onDownloadPdf: () => void;
}

export default function ResumePreview({ 
  imageUrl, 
  onViewPdf, 
  onDownloadPdf
}: SimpleResumePreviewProps) {
  const [imageLoaded, setImageLoaded] = useState(false);

  const handleImageLoad = () => {
    setImageLoaded(true);
  };

  return (
    <div className="w-2/5 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex-shrink-0">
      <div className="p-6 h-full flex flex-col">
        <div className="flex-1 flex flex-col justify-center min-h-0">
          <div className="w-full mx-auto">
            {imageUrl ? (
              <div className="mb-4">
                <div className="relative overflow-hidden rounded-xl shadow-lg border border-gray-200 dark:border-gray-600">
                  <img
                    src={imageUrl}
                    alt="Resume preview"
                    className="w-full object-contain transition-all duration-200"
                    style={{ maxHeight: 'calc(100vh - 180px)' }}
                    onLoad={handleImageLoad}
                  />
                </div>
              </div>
            ) : (
              <div className="w-full aspect-[3/4] bg-gray-100 dark:bg-gray-700 rounded-xl flex items-center justify-center border-2 border-dashed border-gray-300 dark:border-gray-600 mb-4">
                <div className="text-center">
                  <svg className="w-12 h-12 text-gray-400 dark:text-gray-500 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <p className="text-gray-500 dark:text-gray-400">Resume preview not available</p>
                </div>
              </div>
            )}
            
            {/* PDF Action Buttons */}
            <div className="flex space-x-3 w-full">
              <button 
                onClick={onViewPdf}
                className="flex-1 flex items-center justify-center px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors shadow-sm"
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                View Full PDF
              </button>
              <button 
                onClick={onDownloadPdf}
                className="flex-1 flex items-center justify-center px-4 py-3 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 font-medium rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Download PDF
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}