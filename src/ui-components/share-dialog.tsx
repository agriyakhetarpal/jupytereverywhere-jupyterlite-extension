import { ReactWidget } from '@jupyterlab/apputils';

import React from 'react';

/**
 * Share dialog data interface.
 */
export interface IShareDialogData {
  notebookName: string;
  password?: string;
}

/**
 * Share dialog widget for notebook sharing preferences (name, view-only, and a password if applicable).
 */
const ShareDialogComponent: React.FC = () => {
  const generateDefaultName = () => {
    const today = new Date();
    return `Notebook_${today.getFullYear()}-${(today.getMonth() + 1).toString().padStart(2, '0')}-${today.getDate().toString().padStart(2, '0')}`;
  };

  const [notebookName, setNotebookName] = React.useState<string>(generateDefaultName());

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNotebookName(e.target.value);
  };

  return (
    <div>
      <label htmlFor="notebook-name">Notebook Name:</label>
      <input
        id="notebook-name"
        type="text"
        value={notebookName}
        onChange={handleNameChange}
        style={{
          width: '100%',
          marginBottom: '15px',
          padding: '5px'
        }}
        required
      />
    </div>
  );
};

export class ShareDialog extends ReactWidget {
  private _notebookName: string;

  constructor() {
    super();
    // Generate default values
    const today = new Date();
    this._notebookName = `Notebook_${today.getFullYear()}-${(today.getMonth() + 1).toString().padStart(2, '0')}-${today.getDate().toString().padStart(2, '0')}`;
  }

  getValue(): IShareDialogData {
    // Get current values from the DOM
    const nameInput = this.node.querySelector('#notebook-name') as HTMLInputElement;

    return {
      notebookName: nameInput?.value || this._notebookName,    };
  }

  render() {
    return <ShareDialogComponent />;
  }
}

/**
 * Success dialog, shows password only when isNewShare is true.
 */
export const createSuccessDialog = (
  shareableLink: string,
  isNewShare: boolean,
  isViewOnly: boolean,
  password?: string
) => {
  return (
    <div
      style={{
        fontFamily: 'Arial, sans-serif',
        padding: '20px',
        maxWidth: '500px'
      }}
    >
      <h3
        style={{
          color: '#663399',
          fontSize: '18px',
          marginBottom: '15px',
          textAlign: 'center'
        }}
      >
        {isNewShare
          ? 'Here is the shareable link to your new copy:'
          : 'Here is the shareable link to your notebook:'}
      </h3>
      <div
        style={{
          backgroundColor: '#f0f0f0',
          padding: '10px',
          borderRadius: '5px',
          marginBottom: '20px',
          textAlign: 'center'
        }}
      >
        <span
          style={{
            color: '#888',
            fontSize: '14px',
            wordBreak: 'break-all'
          }}
        >
          &lt;link&gt;
        </span>
      </div>

      {isNewShare && password && (
        <>
          <p
            style={{
              color: '#663399',
              fontSize: '16px',
              marginBottom: '10px',
              textAlign: 'center'
            }}
          >
            Here's the code required to edit the original notebook. Make sure to save this code as
            it will not appear again:
          </p>

          <div
            style={{
              backgroundColor: '#f0f0f0',
              padding: '10px',
              borderRadius: '5px',
              marginBottom: '20px',
              textAlign: 'center'
            }}
          >
            <span
              style={{
                color: '#888',
                fontSize: '14px',
                fontFamily: 'monospace'
              }}
            >
              &lt;password&gt;
            </span>
          </div>
        </>
      )}
    </div>
  );
};

/**
 * An error dialog for sharing failures.
 * Displays a generic error message.
 */
export const createErrorDialog = (error: unknown) => {
  return (
    <div>
      <p>Failed to share notebook: {error instanceof Error ? error.message : 'Unknown error'}</p>
    </div>
  );
};
