'use client';
import React, { useState } from 'react';

const copyToClipboard = (text, setCopied) => {
    navigator.clipboard.writeText(text).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    }).catch(err => {
        alert('Gagal menyalin.');
    });
};

const CopyButton = ({ textToCopy, iconOnly = false }) => {
    const [copied, setCopied] = useState(false);
    
    if (iconOnly) {
         return (
            <button
                onClick={() => copyToClipboard(textToCopy, setCopied)}
                className={`w-full h-full flex items-center justify-center transition-all duration-200 rounded-full ${copied ? 'text-green-400' : 'text-current'}`}
                title="Salin Link Endpoint"
            >
                <i className={`fas ${copied ? 'fa-check' : 'fa-share-alt'} text-xs`}></i>
            </button>
        );
    }

    return (
        <button
            onClick={() => copyToClipboard(textToCopy, setCopied)}
            className={`transition-all duration-200 text-xs font-semibold py-1 px-3 rounded-full ${copied ? 'bg-green-600 text-white' : 'bg-gray-600 hover:bg-gray-500 text-gray-200'}`}
        >
            <i className={`fas ${copied ? 'fa-check' : 'fa-copy'} mr-2`}></i>
            {copied ? 'Disalin!' : 'Salin'}
        </button>
    );
};

export default CopyButton;