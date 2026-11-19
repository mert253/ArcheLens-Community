import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { UploadScreen } from '../UploadScreen';
import { OverviewTab } from '../../features/analysis/OverviewTab';

// Mock the i18n module
vi.mock('../../i18n', () => ({
    t: (key: string) => {
        const texts: Record<string, string> = {
            'upload.heading': 'ArcheLens',
            'upload.headingHighlight': 'Pro',
            'upload.button': 'Görsel Yükle',
            'upload.dragDrop': 'Buraya Bırakın',
            'analysis.description': 'Description',
            'analysis.sources': 'Sources',
            'analysis.curatorNote': 'Curator Note',
        };
        return texts[key] || key;
    },
}));

describe('UploadScreen', () => {
    const mockProps = {
        fileInputRef: { current: null },
        onFileChange: vi.fn(),
        onMultiFileChange: vi.fn(),
        onUrlAnalyze: vi.fn(),
        lang: 'tr' as const,
    };

    it('renders the upload screen correctly', () => {
        render(<UploadScreen {...mockProps} />);
        expect(screen.getByText(/ArcheLens/i)).toBeInTheDocument();
        expect(screen.getByText(/Görsel Yükle/i)).toBeInTheDocument();
    });

    it('switches to multi upload mode and supports keyboard activation on multi-dropzone', () => {
        render(<UploadScreen {...mockProps} />);
        const multiBtn = screen.getByRole('button', { name: /Çoklu Yükleme/i });
        fireEvent.click(multiBtn);
        const dropzone = screen.getByRole('button', { name: /Birden fazla görsel yükleyin/i });
        const input = dropzone.querySelector('input[type="file"]') as HTMLInputElement;
        const clickSpy = vi.spyOn(input, 'click');
        fireEvent.keyDown(dropzone, { key: 'Enter' });
        expect(clickSpy).toHaveBeenCalledTimes(1);
    });

    it('filters unsafe groundingUrls protocols in OverviewTab', () => {
        render(
            <OverviewTab
                lang="en"
                result={{
                    title: 'Vase',
                    confidence_score: 90,
                    origin: { region: 'Attica', culture: 'Greek' },
                    dating: { period: 'Classical', date_range: '450 BC', century: '5th BC' },
                    specs: { style: 'Red-figure', material: 'Clay', technique: 'Wheel', dimensions: '30cm' },
                    analysis: { description: 'Desc', iconography: 'Icon', inscription: null },
                    preservation: { condition: 'Good', damages: 'Minor' },
                    fun_fact: 'Fact',
                    curator_note: 'Note',
                    groundingUrls: [
                        { title: 'Unsafe Link', uri: 'javascript:alert(1)' },
                        { title: 'Safe Museum Link', uri: 'https://www.metmuseum.org/art/collection' },
                    ],
                }}
            />
        );
        expect(screen.queryByText('Unsafe Link')).not.toBeInTheDocument();
        const safeLink = screen.getByText('Safe Museum Link').closest('a');
        expect(safeLink).toHaveAttribute('href', 'https://www.metmuseum.org/art/collection');
    });
});

