import React, { useEffect, useRef, useState, forwardRef, useImperativeHandle } from 'react';

// Declare the global variable for TypeScript
declare global {
  interface Window {
    YT: typeof YT;
    onYouTubeIframeAPIReady: () => void;
    EXPLICIT_PLAY_REQUESTED?: boolean;
  }
}

interface YoutubePlayerProps {
  videoId: string;
  currentTime?: number;
  onSeek?: (time: number) => void;
  height?: number;
  width?: string | number;
}

export const YoutubePlayer = forwardRef<{ playFromTime: (time: number) => void; getPlayer: () => YT.Player | null }, YoutubePlayerProps>(({ 
  videoId, 
  currentTime = 0, 
  onSeek, 
  height = 225, 
  width = '100%' 
}, ref) => {
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
          start: Math.floor(currentTime || 0)
        },
        events: {
          onReady: (event) => {
            setIsReady(true);
            console.log('YoutubePlayer: Player ready');
            
            // If we have a currentTime, seek to it but don't play automatically
            if (currentTime && currentTime > 0) {
              console.log('YoutubePlayer: Initial seek to', currentTime);
              event.target.seekTo(currentTime, true);
            }
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
      console.log('YoutubePlayer: currentTime changed to:', currentTime);
      const currentPlayerTime = playerRef.current.getCurrentTime();
      
      // Only seek if the difference is more than 0.5 seconds to avoid loops
      if (Math.abs(currentPlayerTime - currentTime) > 0.5) {
        console.log('YoutubePlayer: Seeking from', currentPlayerTime, 'to', currentTime);
        
        // Force seeking to the exact time
        playerRef.current.seekTo(currentTime, true);
        
        // Don't automatically play after seeking
        // Only play if explicitly requested via a transcript chunk click
        if (window.EXPLICIT_PLAY_REQUESTED) {
          setTimeout(() => {
            if (playerRef.current) {
              playerRef.current.playVideo();
              console.log('YoutubePlayer: Playing after seek');
              // Reset the flag
              window.EXPLICIT_PLAY_REQUESTED = false;
            }
          }, 100);
        }
      }
    }
  }, [currentTime, isReady]);

  // Add a function to handle external play commands
  const playFromTime = (time: number) => {
    console.log('YoutubePlayer: External request to play from time:', time);
    if (isReady && playerRef.current) {
      // Force seeking to the exact time
      playerRef.current.seekTo(time, true);
      
      // Only play if explicitly requested via a transcript chunk click
      // The video will not play automatically when a reference is clicked
      if (window.EXPLICIT_PLAY_REQUESTED) {
        setTimeout(() => {
          if (playerRef.current) {
            playerRef.current.playVideo();
            console.log('YoutubePlayer: Playing video from time:', time);
            // Reset the flag
            window.EXPLICIT_PLAY_REQUESTED = false;
          }
        }, 100);
      }
    } else {
      console.log('YoutubePlayer: Player not ready yet, will try again');
      // If player is not ready, try again after a short delay
      setTimeout(() => {
        if (playerRef.current) {
          playerRef.current.seekTo(time, true);
          playerRef.current.playVideo();
          console.log('YoutubePlayer: Playing video after delay from time:', time);
        }
      }, 1000);
    }
  };

  // Expose the player methods to parent components
  useImperativeHandle(
    ref,
    () => ({
      playFromTime,
      getPlayer: () => playerRef.current
    }),
    [isReady]
  );

  return <div ref={containerRef} />;
}); 