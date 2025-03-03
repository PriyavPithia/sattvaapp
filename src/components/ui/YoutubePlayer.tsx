import React, { useEffect, useRef, useState } from 'react';

interface YoutubePlayerProps {
  videoId: string;
  currentTime?: number;
  onSeek?: (time: number) => void;
  height?: number;
  width?: string | number;
}

export function YoutubePlayer({ 
  videoId, 
  currentTime = 0, 
  onSeek, 
  height = 225, 
  width = '100%' 
}: YoutubePlayerProps) {
  const playerRef = useRef<YT.Player | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isReady, setIsReady] = useState(false);
  const [isApiLoaded, setIsApiLoaded] = useState(false);

  // Load YouTube API
  useEffect(() => {
    if (!window.YT) {
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      const firstScriptTag = document.getElementsByTagName('script')[0];
      firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);
      
      window.onYouTubeIframeAPIReady = () => {
        setIsApiLoaded(true);
      };
    } else {
      setIsApiLoaded(true);
    }

    return () => {
      // Cleanup
      if (playerRef.current) {
        playerRef.current.destroy();
      }
    };
  }, []);

  // Initialize player when API is loaded and videoId is available
  useEffect(() => {
    if (isApiLoaded && videoId && containerRef.current) {
      if (playerRef.current) {
        playerRef.current.destroy();
      }

      playerRef.current = new window.YT.Player(containerRef.current, {
        videoId,
        height,
        width,
        playerVars: {
          autoplay: 0,
          modestbranding: 1,
          rel: 0,
        },
        events: {
          onReady: () => {
            setIsReady(true);
          },
          onStateChange: (event) => {
            // You can handle state changes here if needed
            if (event.data === window.YT.PlayerState.PLAYING && onSeek) {
              // Start a timer to periodically update the current time
              const interval = setInterval(() => {
                if (playerRef.current) {
                  onSeek(playerRef.current.getCurrentTime());
                }
              }, 1000);
              
              return () => clearInterval(interval);
            }
          },
        },
      });
    }
  }, [isApiLoaded, videoId, height, width]);

  // Seek to currentTime when it changes
  useEffect(() => {
    if (isReady && playerRef.current && currentTime !== undefined) {
      const currentPlayerTime = playerRef.current.getCurrentTime();
      // Only seek if the difference is more than 1 second to avoid loops
      if (Math.abs(currentPlayerTime - currentTime) > 1) {
        playerRef.current.seekTo(currentTime, true);
      }
    }
  }, [currentTime, isReady]);

  return <div ref={containerRef} />;
}

// Add YouTube Player API types
declare global {
  interface Window {
    YT: typeof YT;
    onYouTubeIframeAPIReady: () => void;
  }
} 