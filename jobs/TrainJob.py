import json
import os
import threading
from queue import Queue

from jobs import BaseJob
from toolkit.kohya_model_util import load_models_from_stable_diffusion_checkpoint
from collections import OrderedDict
from typing import List
from jobs.process import BaseExtractProcess, TrainFineTuneProcess
from datetime import datetime


process_dict = {
    'vae': 'TrainVAEProcess',
    'slider': 'TrainSliderProcess',
    'slider_old': 'TrainSliderProcessOld',
    'lora_hack': 'TrainLoRAHack',
    'rescale_sd': 'TrainSDRescaleProcess',
    'esrgan': 'TrainESRGANProcess',
    'reference': 'TrainReferenceProcess',
}


class _TrainingJobQueue:
    """Simple queue to ensure training jobs run sequentially."""

    def __init__(self):
        # Queue of (job, event) pairs. The event is set when the job finishes.
        self._queue = Queue()
        self._worker = threading.Thread(target=self._worker_loop, daemon=True)
        self._worker.start()

    def enqueue(self, job: "TrainJob"):
        done = threading.Event()
        # Add job to the queue and wait until it is executed
        self._queue.put((job, done))
        done.wait()

    def _worker_loop(self):
        while True:
            job, done = self._queue.get()
            try:
                job._execute()
            finally:
                # Signal the waiting thread that the job finished
                done.set()
                self._queue.task_done()


# Global queue instance used by all TrainJob instances
_training_job_queue = _TrainingJobQueue()


class TrainJob(BaseJob):

    def __init__(self, config: OrderedDict):
        super().__init__(config)
        self.training_folder = self.get_conf('training_folder', required=True)
        self.is_v2 = self.get_conf('is_v2', False)
        self.device = self.get_conf('device', 'cpu')
        # self.gradient_accumulation_steps = self.get_conf('gradient_accumulation_steps', 1)
        # self.mixed_precision = self.get_conf('mixed_precision', False)  # fp16
        self.log_dir = self.get_conf('log_dir', None)

        # loads the processes from the config
        self.load_processes(process_dict)

    def run(self):
        """Add the job to the global training queue and wait for completion."""
        _training_job_queue.enqueue(self)

    # internal method executed by the queue worker
    def _execute(self):
        super().run()
        print("")
        print(f"Running  {len(self.process)} process{'' if len(self.process) == 1 else 'es'}")

        for process in self.process:
            process.run()
