import { Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react'
import { withTranslation } from 'react-i18next'
import type { WithTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import logger from '@/config/logger'

interface ErrorBoundaryOwnProps {
  children: ReactNode
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

type ErrorBoundaryProps = ErrorBoundaryOwnProps & WithTranslation

/**
 * Catch render-time exceptions and display a recoverable fallback UI.
 *
 * Wrap independent UI sections separately so a crash in one panel
 * does not take down the entire page.
 */
class ErrorBoundaryInner extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    logger.error('ErrorBoundary caught', { error: error.message, stack: info.componentStack })
  }

  handleReset = (): void => {
    this.setState({ hasError: false, error: null })
  }

  render(): ReactNode {
    if (!this.state.hasError) return this.props.children

    const { t } = this.props

    return (
      <div
        role="alert"
        className="border-destructive/30 bg-destructive/5 flex flex-col items-center justify-center gap-4 rounded-xl border p-8 text-center"
      >
        <p className="text-destructive text-sm font-medium">{t('error.boundary.title')}</p>
        <p className="text-muted-foreground text-xs">{t('error.boundary.description')}</p>
        <Button variant="outline" size="sm" onClick={this.handleReset}>
          {t('error.boundary.retry')}
        </Button>
      </div>
    )
  }
}

export const ErrorBoundary = withTranslation()(ErrorBoundaryInner)
