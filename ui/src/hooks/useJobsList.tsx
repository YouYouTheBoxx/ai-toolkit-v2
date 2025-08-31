'use client';

import { useEffect, useState } from 'react';
import { Job } from '@prisma/client';
import { apiClient } from '@/utils/api';

export default function useJobsList(onlyActive = false, reloadInterval: number | null = null) {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');

  const refreshJobs = () => {
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
  };
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
  }, [reloadInterval, onlyActive]);

  return { jobs, setJobs, status, refreshJobs };
}
