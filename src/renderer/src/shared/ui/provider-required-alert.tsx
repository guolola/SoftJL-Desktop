// Shadcn Studio @ss-components/alert-08 source; copy and actions adapted for provider setup.
'use client'

import { useState } from 'react'
import { Alert, AlertAction, AlertDescription, AlertTitle } from '@/shared/ui/alert'
import { Button } from '@/shared/ui/button'
import { CircleAlertIcon, XIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'

const ProviderRequiredAlert = ({ onConfigure }: { onConfigure: () => void }) => {
  const [isActive, setIsActive] = useState(true)
  const { t } = useTranslation()

  if (!isActive) return null

  return (
    <Alert className='bg-primary text-primary-foreground border-none'>
      <CircleAlertIcon />
      <AlertTitle>{t('providerNotice.title')}</AlertTitle>
      <AlertDescription className='text-primary-foreground/80'>
        <p className='mb-2!'>{t('providerNotice.description')}</p>
        <div className='flex items-center gap-3'>
          <Button
            size='xs'
            className='bg-secondary/10 hover:bg-secondary/20 focus-visible:bg-secondary/20 cursor-pointer'
            onClick={() => setIsActive(false)}
          >
            {t('providerNotice.later')}
          </Button>
          <Button variant='secondary' size='xs' className='cursor-pointer' onClick={() => { setIsActive(false); onConfigure() }}>
            {t('providerNotice.configure')}
          </Button>
        </div>
      </AlertDescription>
      <AlertAction>
        <button type='button' className='cursor-pointer' onClick={() => setIsActive(false)}>
          <XIcon className='size-4' />
          <span className='sr-only'>{t('common.close')}</span>
        </button>
      </AlertAction>
    </Alert>
  )
}

export default ProviderRequiredAlert
