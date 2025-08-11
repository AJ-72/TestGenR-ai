import React, { useState, useEffect } from 'react';
import { invoke } from '@forge/bridge';

const App = () => {
  const [statuses, setStatuses] = useState([]);
  const [config, setConfig] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [statusData, configData] = await Promise.all([
        invoke('getStatuses'),
        invoke('getConfig')
      ]);
      setStatuses(statusData || []);
      setConfig(configData || {});
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const data = Object.fromEntries(formData);
    
    try {
      await invoke('saveConfig', data);
      alert('Configuration saved successfully!');
    } catch (error) {
      console.error('Failed to save config:', error);
      alert('Failed to save configuration');
    }
  };

  if (loading) return <div>Loading...</div>;

  const styles = {
    container: { padding: '20px', maxWidth: '600px', fontFamily: 'Arial, sans-serif' },
    formGroup: { marginBottom: '16px' },
    label: { display: 'block', marginBottom: '4px', fontWeight: 'bold' },
    input: { width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px', boxSizing: 'border-box' },
    textarea: { width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px', minHeight: '80px', boxSizing: 'border-box' },
    button: { backgroundColor: '#0052CC', color: 'white', padding: '8px 16px', border: 'none', borderRadius: '4px', cursor: 'pointer' },
    version: { fontSize: '12px', color: '#666', marginBottom: '16px' },
    helpText: { fontSize: '12px', color: '#666', marginTop: '4px' }
  };

  return (
    <div style={styles.container}>
      <h2>TestCase Generator Configuration</h2>
      <div style={styles.version}>Version 1.0.18</div>
      <p>Configure AWS Bedrock to generate test cases automatically when stories transition to the selected status.</p>
      
      <form onSubmit={handleSubmit}>
        <div style={styles.formGroup}>
          <label style={styles.label}>Trigger Status *</label>
          <select name="triggerStatus" required defaultValue={config.triggerStatus || ''} style={styles.input}>
            <option value="">Select status to trigger generation</option>
            {statuses.map(status => (
              <option key={status.name} value={status.name}>{status.name}</option>
            ))}
          </select>
        </div>

        <div style={styles.formGroup}>
          <label style={styles.label}>AWS Access Key ID *</label>
          <input
            name="accessKey"
            type="text"
            required
            defaultValue={config.accessKey || ''}
            placeholder="Your AWS Access Key"
            style={styles.input}
          />
        </div>

        <div style={styles.formGroup}>
          <label style={styles.label}>AWS Secret Access Key *</label>
          <input
            name="secretKey"
            type="password"
            required
            defaultValue={config.secretKey || ''}
            placeholder="Your AWS Secret Key"
            style={styles.input}
          />
        </div>

        <div style={styles.formGroup}>
          <label style={styles.label}>AWS Session Token (Optional)</label>
          <input
            name="sessionToken"
            type="password"
            defaultValue={config.sessionToken || ''}
            placeholder="Required for temporary credentials (ASIA...)"
            style={styles.input}
          />
          <div style={styles.helpText}>Only needed if using temporary AWS credentials (Access Key starts with ASIA)</div>
        </div>

        <div style={styles.formGroup}>
          <label style={styles.label}>AWS Region</label>
          <input
            name="region"
            type="text"
            defaultValue={config.region || 'us-east-1'}
            placeholder="us-east-1"
            style={styles.input}
          />
        </div>

        <div style={styles.formGroup}>
          <label style={styles.label}>Test Case Limit (Max: 15)</label>
          <input
            name="limit"
            type="number"
            min="1"
            max="15"
            defaultValue={config.limit || '5'}
            placeholder="5"
            style={styles.input}
          />
        </div>

        <div style={styles.formGroup}>
          <label style={styles.label}>AI Prompt Template</label>
          <textarea
            name="prompt"
            defaultValue={config.prompt || 'Write test cases for the following story requirements: {description}'}
            placeholder="Write test cases for the following story requirements: {description}"
            style={styles.textarea}
          />
          <div style={styles.helpText}>Use {'{description}'} placeholder for story content</div>
        </div>

        <button type="submit" style={styles.button}>
          Save Configuration
        </button>
      </form>
    </div>
  );
};

export default App;