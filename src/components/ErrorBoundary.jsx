import { Component } from "react";

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error(`[ErrorBoundary: ${this.props.name}]`, error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="error-boundary-fallback">
          <span className="error-boundary-fallback__title">
            {this.props.name} crashed
          </span>
          <span className="error-boundary-fallback__message">
            {this.state.error.message}
          </span>
          <button
            className="settings-footer-button settings-create-button"
            style={{ marginTop: "8px" }}
            onClick={() => this.setState({ error: null })}
          >
            Reload panel
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
