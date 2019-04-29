import React from "react";
import PropTypes from "prop-types";
import AbstractComponent from "component/AbstractComponent";
import ErrorBoundary from "component/ErrorBoundary";
import { ConfigForm } from "./ConfigForm";
import { RemoteForm } from "./RemoteForm";

export class GitPane extends AbstractComponent {


  render() {

    return (
      <ErrorBoundary>
        <p>With <a href="https://git-scm.com/book/en/v2" onClick={ this.onExtClick }>GIT</a> you can
        embrace version control for your project. Namely you can later examine (<code>checkout</code>) earlier committed
        versions or rollback (<code>revert</code>) any of them. You can also synchronize (<code>pull/push</code>) versions
        with a remote repository. You can also create
        a new project our of a remotely stored version (<code>clone</code>).</p>
        <ConfigForm { ...this.props } />
        <RemoteForm { ...this.props } />
      </ErrorBoundary>
    );
  }
}