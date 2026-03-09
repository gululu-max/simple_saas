'use client';

import React, { useRef, useState } from 'react';
import { 
  Image as ImageIcon, 
  Target, 
  Upload, 
  XCircle, 
  Trophy,
  BarChart3,
  CheckCircle,
  AlertTriangle,
  Zap,
  Loader2,
  FileImage, // 🔴 New import: File image icon
  Download   // 🔴 New import: Download icon
} from 'lucide-react';
import { toPng } from 'html-to-image'; // 🔴 New import: html-to-image core function

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

// ================= Image Compression =================
async function compressImage(
  file: File,
  options?: { maxSize?: number; quality?: number }
): Promise<string> {
  const { maxSize = 1024, quality = 0.75 } = options || {};

  const img = new Image();
  const url = URL.createObjectURL(file);
  img.src = url;

  await new Promise((resolve, reject) => {
    img.onload = resolve;
    img.onerror = reject;
  });

  let { width, height } = img;

  if (width > height && width > maxSize) {
    height = Math.round((height * maxSize) / width);
    width = maxSize;
  } else if (height > maxSize) {
    width = Math.round((width * maxSize) / height);
    height = maxSize;
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(img, 0, 0, width, height);

  URL.revokeObjectURL(url);

  return canvas.toDataURL('image/jpeg', quality);
}

interface PhotoPreview {
  id: string;
  file: File;
  preview: string;
}

export default function PhotoScorer() {
  const [photos, setPhotos] = useState<PhotoPreview[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<any>(null);
  
  // 🔴 Lifesaving fix 1: Add loading state during export
  const [isExporting, setIsExporting] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  // 🔴 Lifesaving fix 2: Create a ref bound to the container you want to screenshot
  const reportRef = useRef<HTMLDivElement>(null);

  // ================= File Selection =================
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const imageFiles = files.filter(file => file.type.startsWith('image/'));
    if (imageFiles.length !== files.length) {
      alert('Only image files can be uploaded');
      return;
    }

    const oversizedFiles = imageFiles.filter(file => file.size > 10 * 1024 * 1024);
    if (oversizedFiles.length > 0) {
      alert('Some files are too large, please compress before uploading (Max 10MB)');
      return;
    }

    const newPhotos: PhotoPreview[] = [];
    for (const file of imageFiles) {
      const compressed = await compressImage(file, {
        maxSize: 1024, // Ensure the image sent to the backend is not too large
        quality: 0.75,
      });
      newPhotos.push({
        id: `${Date.now()}-${Math.random()}`,
        file,
        preview: compressed,
      });
    }

    const totalPhotos = photos.length + newPhotos.length;
    if (totalPhotos > 9) {
      alert('You can only upload up to 9 photos');
      const remaining = 9 - photos.length;
      setPhotos([...photos, ...newPhotos.slice(0, remaining)]);
    } else {
      setPhotos([...photos, ...newPhotos]);
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removePhoto = (id: string) => {
    setPhotos(photos.filter(p => p.id !== id));
  };

  // ================= Submit =================
  const handleSubmit = async () => {
    if (photos.length < 3 || isLoading) return;
    setIsLoading(true);
    setAnalysisResult(null); // Clear previous results

    try {
      const images = photos.map(p => ({
        base64: p.preview.split(',')[1],
        mimeType: 'image/jpeg',
      }));

      const response = await fetch('/api/photo-scorer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ images }),
      });

      if (!response.ok) throw new Error('AI parsing failed');
      
      const data = await response.json();
      setAnalysisResult(data);

    } catch (error) {
      console.error(error);
      alert('The server wandered off, please try again!');
    } finally {
      setIsLoading(false);
    }
  };

  // 🔴 New feature: Export image logic
  const handleExportImage = async () => {
    if (reportRef.current === null) return;
    setIsExporting(true);

    try {
      // Fix blurry export on high DPI screens, set pixelRatio to 2
      const dataUrl = await toPng(reportRef.current, { cacheBust: true, pixelRatio: 2 });
      
      // Create a temporary <a> tag to trigger download
      const link = document.createElement('a');
      link.download = `Matchfix-Dating-Analysis-${Date.now()}.png`;
      link.href = dataUrl;
      link.click();

    } catch (err) {
      console.error('oops, something went wrong!', err);
      alert('Image generation failed, please try again later!');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="w-full text-foreground">
      <div className="mx-auto flex w-full flex-col gap-6">
        
        {/* Header Section */}
        <div className="flex flex-col gap-3 mb-2">
          <div className="flex items-center gap-3">
            <div className="grid size-12 place-items-center rounded-xl bg-primary/10">
              <Target className="size-6 text-primary" />
            </div>
            <div className="flex flex-col">
              <h1 className="text-balance text-2xl font-bold tracking-tight sm:text-3xl text-foreground">
                AI Photo Scorer
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                Upload 3-9 photos → AI scoring & ranking → Design Profile order
              </p>
            </div>
          </div>
        </div>

        {/* Upload Card */}
        <Card className="border-border bg-card shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-foreground">
              <ImageIcon className="size-5 text-muted-foreground" />
              Upload your photos (3-9 photos)
            </CardTitle>
            <CardDescription className="text-muted-foreground">
              Supports JPG/PNG. AI will score and rank each photo, and design the best Profile display order.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            
            {/* Photo Grid */}
            {photos.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {photos.map((photo, index) => (
                  <div
                    key={photo.id}
                    className="relative group aspect-square rounded-lg overflow-hidden border-2 border-border bg-muted/30"
                  >
                    <img
                      src={photo.preview}
                      alt={`Photo ${photo.id}`}
                      className="h-full w-full object-cover"
                    />
                    <button
                      onClick={() => removePhoto(photo.id)}
                      className="absolute top-2 right-2 p-1.5 rounded-full bg-destructive/80 hover:bg-destructive text-white opacity-0 group-hover:opacity-100 transition-opacity"
                      disabled={isLoading}
                    >
                      <XCircle className="size-4" />
                    </button>
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-2">
                      <div className="text-xs text-white font-medium">
                        Photo {index + 1}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Upload Area */}
            {photos.length < 9 && (
              <div
                role="button"
                tabIndex={0}
                onClick={() => fileInputRef.current?.click()}
                className="group relative grid min-h-[200px] w-full cursor-pointer place-items-center overflow-hidden rounded-xl border-2 border-dashed border-muted-foreground/20 bg-muted/30 outline-none transition-all hover:border-primary/40 hover:bg-primary/5 focus-visible:ring-2 focus-visible:ring-primary/60"
              >
                <div className="flex flex-col items-center gap-4 px-6 py-10 text-center">
                  <div className="grid size-14 place-items-center rounded-2xl bg-background border border-border shadow-sm">
                    <Upload className="size-6 text-muted-foreground/70" />
                  </div>
                  <div className="space-y-1">
                    <div className="text-base font-semibold text-foreground">
                      {photos.length === 0 
                        ? 'Click to upload photos (at least 3, up to 9) 📸'
                        : `Uploaded ${photos.length}/9 photos, continue adding...`}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Supports multiple selection, or drag and drop files here
                    </div>
                  </div>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleFileSelect}
                  className="hidden"
                />
              </div>
            )}

            {/* Action Bar */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between pt-2 border-t border-border">
              <div className="text-sm text-muted-foreground">
                {photos.length >= 3 
                  ? `✅ Uploaded ${photos.length} photos, ready to score` 
                  : photos.length > 0
                  ? `⚠️ Need to upload ${3 - photos.length} more photos (at least 3)`
                  : 'No photos uploaded yet'}
              </div>
              <div className="flex items-center gap-3 w-full sm:w-auto">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1 sm:flex-none h-11 text-muted-foreground gap-2"
                  onClick={() => {
                    setPhotos([]);
                    setAnalysisResult(null);
                    if (fileInputRef.current) fileInputRef.current.value = '';
                  }}
                  disabled={isLoading}
                >
                  <XCircle className="w-4 h-4" /> Clear all
                </Button>
                
                <Button
                  type="button"
                  onClick={handleSubmit}
                  disabled={isLoading || photos.length < 3}
                  className="flex-1 sm:flex-none h-11 bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 font-bold px-6"
                >
                  {isLoading ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Analyzing...</>
                  ) : (
                    <span className="flex items-center gap-2">
                      <BarChart3 className="w-4 h-4" />
                      Start Scoring & Ranking
                      <span className="inline-flex items-center rounded-full bg-background/20 px-2 py-0.5 text-xs font-semibold backdrop-blur-sm">
                        🪙 1 Credit
                      </span>
                    </span>
                  )}
                </Button>
              </div>
            </div>
          </CardContent>
          <CardFooter className="text-xs text-muted-foreground/60 bg-muted/20 py-4 rounded-b-xl">
            AI will do for you: 1️⃣ Score each photo 2️⃣ Rank 3️⃣ Detailed explanation 4️⃣ Design Profile order
          </CardFooter>
        </Card>

        {/* ================= Result Card ================= */}
        {(analysisResult || isLoading) && (
          <Card 
            className="border-border bg-card shadow-sm overflow-hidden mt-6 animate-in fade-in slide-in-from-bottom-4"
          >
            <CardHeader className="bg-primary/5 border-b border-border flex flex-row items-center justify-between py-4">
              <CardTitle className="text-primary flex items-center gap-2 text-lg">
                <Trophy className="size-5 text-amber-500" />
                AI Scoring & Strategy Report
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              
              {/* Loading state */}
              {isLoading ? (
                <div className="flex flex-col items-center justify-center py-12 space-y-4">
                  <div className="flex space-x-1.5 items-center">
                    <div className="w-2.5 h-2.5 bg-primary/60 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                    <div className="w-2.5 h-2.5 bg-primary/60 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                    <div className="w-2.5 h-2.5 bg-primary/60 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                  </div>
                  <p className="text-muted-foreground italic text-sm font-medium animate-pulse text-center">
                    AI is transforming into a top dating coach, analyzing your profile...
                  </p>
                </div>
              ) : (
                
                /* Analysis results display */
                <div className="flex flex-col gap-10">
                  
                  {/* 🔴 Lifesaving fix 3: Create a container wrapping everything you want to screenshot, and bind reportRef to this div */}
                  {/* We add bg-card to this div to ensure the generated image background is also dark, preventing glitches */}
                  <div ref={reportRef} className="bg-card flex flex-col gap-10 p-2 rounded-xl">
                    {/* 🏆 Module A: Best appearance order */}
                    <div>
                      <h3 className="text-lg font-bold flex items-center gap-2 mb-4">
                        <Zap className="w-5 h-5 text-amber-500" />
                        Best Profile Order (The Perfect Lineup)
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {analysisResult.profileSequence?.map((item: any, index: number) => {
                          const photoData = photos[item.imageIndex];
                          if (!photoData) return null; // Prevent out of bounds
                          return (
                            <div key={index} className="flex flex-col bg-muted/30 rounded-xl border border-border overflow-hidden">
                              <div className="relative aspect-square">
                                <div className="absolute top-2 left-2 bg-primary text-primary-foreground px-2 py-1 rounded-md font-black text-sm z-10 shadow-md">
                                  #{index + 1}
                                </div>
                                <img src={photoData.preview} className="w-full h-full object-cover" alt={`Rank ${index + 1}`} />
                              </div>
                              <div className="p-4 flex flex-col gap-1">
                                <Badge className="w-fit mb-1" variant="secondary">{item.role}</Badge>
                                <span className="text-sm text-foreground leading-relaxed">{item.reason}</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* 🔍 Module B: Single photo in-depth analysis */}
                    <div>
                      <h3 className="text-lg font-bold flex items-center gap-2 mb-4">
                        <Target className="w-5 h-5 text-primary" /> 
                        Brutally Honest Analysis of Each Photo
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {analysisResult.photoDetails?.map((detail: any, index: number) => {
                          const photoData = photos[detail.imageIndex];
                          if (!photoData) return null;
                          return (
                            <Card key={index} className="overflow-hidden bg-background border-border shadow-sm">
                              <div className="flex h-full">
                                <div className="w-2/5 shrink-0">
                                  <img src={photoData.preview} className="w-full h-full object-cover" alt="review" />
                                </div>
                                <div className="w-3/5 p-4 flex flex-col justify-between">
                                  <div>
                                    <div className="flex justify-between items-center mb-3">
                                      <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Photo {detail.imageIndex + 1}</span>
                                      <Badge variant={detail.score >= 70 ? "default" : "destructive"}>
                                        Score: {detail.score}
                                      </Badge>
                                    </div>
                                    <ul className="space-y-2 text-sm">
                                      <li className="flex gap-2 items-start">
                                        <CheckCircle className="w-4 h-4 text-green-500 shrink-0 mt-0.5" /> 
                                        <span className="text-foreground leading-snug">{detail.pros}</span>
                                      </li>
                                      <li className="flex gap-2 items-start">
                                        <AlertTriangle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" /> 
                                        <span className="text-foreground leading-snug">{detail.cons}</span>
                                      </li>
                                    </ul>
                                  </div>
                                  <div className="mt-4 pt-3 border-t border-border/50 text-sm">
                                    <span className="font-semibold text-primary">🔨 Rescue Plan:</span> 
                                    <span className="text-muted-foreground ml-1">{detail.action}</span>
                                  </div>
                                </div>
                              </div>
                            </Card>
                          );
                        })}
                      </div>
                    </div>
                    
                    {/* 🔴 Module C: Add a footer with brand logo to make the generated image look more professional */}
                    <div className="flex justify-between items-center pt-6 mt-6 border-t border-border text-xs text-muted-foreground/60">
                        <span>Generated by Matchfix - Your Brutally Honest Dating Profile Coach</span>
                        <span>matchfix.site</span>
                    </div>
                  </div>

                  {/* 🔴 Add a button operation area at the bottom */}
                  <div className="flex items-center gap-3 pt-6 border-t border-border">
                    <Button variant="outline" onClick={() => setAnalysisResult(null)} className="h-12 flex-none px-6 text-muted-foreground">
                      Retest
                    </Button>
                    
                    {/* 👉 Here is the core: One-click export to image button */}
                    <Button 
                      onClick={handleExportImage} 
                      disabled={isExporting}
                      className="flex-1 h-12 bg-primary text-primary-foreground font-bold text-base gap-2"
                    >
                      {isExporting ? (
                        <><Loader2 className="w-5 h-5 animate-spin" /> Generating image...</>
                      ) : (
                        <><FileImage className="w-5 h-5" /> Export Analysis Report Image</>
                      )}
                    </Button>
                  </div>

                </div>
              )}
            </CardContent>
          </Card>
        )}

      </div>
    </div>
  );
}