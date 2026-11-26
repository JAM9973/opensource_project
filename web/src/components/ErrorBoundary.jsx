import { Component } from 'react'
import StatusMessage from './StatusMessage.jsx'

/** 한 화면의 렌더링 오류가 전체 앱을 멈추지 않게 한다. */
export default class ErrorBoundary extends Component {
  state = { error: null }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidUpdate(prev) {
    if (prev.resetKey !== this.props.resetKey && this.state.error) this.setState({ error: null })
  }

  render() {
    if (this.state.error) {
      return <StatusMessage kind="error" title="화면을 표시하지 못했습니다">{String(this.state.error.message ?? this.state.error)}</StatusMessage>
    }
    return this.props.children
  }
}
