import React from 'react';

const MethodBadge = ({ method }) => {
    const colors = {
        'GET': 'bg-sky-600 text-sky-100',
        'POST': 'bg-emerald-600 text-emerald-100',
        'PUT': 'bg-amber-600 text-amber-100',
        'DELETE': 'bg-red-600 text-red-100',
    };
    return (
        <span className={`w-20 text-center text-sm font-bold rounded px-2 py-1 ${colors[method] || 'bg-gray-600 text-gray-100'}`}>
            {method}
        </span>
    );
};

export default MethodBadge;