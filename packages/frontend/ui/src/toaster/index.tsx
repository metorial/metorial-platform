import React from 'react';
import { Toaster as BaseToaster, toast } from 'sonner';

export let Toaster = () => <BaseToaster position="bottom-right" richColors />;

export { toast };
