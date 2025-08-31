'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { Job } from '@prisma/client';
import { apiClient } from '@/utils/api';
import { startJob } from '@/utils/jobs';

export default function useJobsList(onlyActive = false, reloadInterval: number | null = null) {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');

  const refreshJobs = useCallback(() => {
    setStatus('loading');
    apiClient
      .get('/api/jobs')
      .then(res => res.data)
      .then(data => {
        console.log('Jobs:', data);
        if (data.error) {
          console.log('Error fetching jobs:', data.error);
          setStatus('error');
        } else {
          if (onlyActive) {
            data.jobs = data.jobs.filter((job: Job) => job.status === 'running');
          }
          setJobs(data.jobs);
          setStatus('success');
        }
      })
      .catch(error => {
        console.error('Error fetching datasets:', error);
        setStatus('error');
      });
  }, [onlyActive]);
  useEffect(() => {
    refreshJobs();

    if (reloadInterval) {
      const interval = setInterval(() => {
        refreshJobs();
      }, reloadInterval);

      return () => {
        clearInterval(interval);
      };
    }
  }, [reloadInterval, onlyActive, refreshJobs]);

  const startingRef = useRef(false);

  useEffect(() => {
    if (startingRef.current) return;
    const running = jobs.some(job => job.status === 'running');
    if (!running) {
      const next = jobs.find(job => job.status === 'queued');
      if (next) {
        startingRef.current = true;
        startJob(next.id)
          .catch(() => {
            // ignore errors; will retry on next refresh
          })
          .finally(() => {
            startingRef.current = false;
            refreshJobs();
          });
      }
    }
  }, [jobs, refreshJobs]);

  return { jobs, setJobs, status, refreshJobs };
}
