import { App, Notice } from 'obsidian';
import { DatabaseReplicationService } from './DatabaseReplicationService';

/**
 * Service to run performance tests and generate reports
 */
export class PerformanceTestService {
  private app: App;
  private dbReplicationService: DatabaseReplicationService | null = null;
  private previousReports: Record<string, any>[] = [];

  constructor(app: App) {
    this.app = app;
  }

  /**
   * Get or create the database replication service
   */
  private getDbReplicationService(): DatabaseReplicationService {
    if (!this.dbReplicationService) {
      this.dbReplicationService = new DatabaseReplicationService(this.app);
    }
    return this.dbReplicationService;
  }

  /**
   * Run a performance test for database replication
   */
  async runDatabaseReplicationTest(options: {
    testRuns?: number;
    clearDatabase?: boolean;
    compareWithPrevious?: boolean;
  } = {}): Promise<void> {
    try {
      // Set default options
      const testRuns = options.testRuns || 3;
      const clearDatabase = options.clearDatabase || false;
      const compareWithPrevious = options.compareWithPrevious || false;

      // Clear console for clean output
      console.clear();
      console.log('Starting database replication performance test...');

      // Clear database if requested
      if (clearDatabase) {
        console.log('Clearing database before test...');
        await this.clearDatabase();
      }

      // Get the database replication service
      const dbReplicationService = this.getDbReplicationService();

      // Run the test multiple times to get more accurate results
      const results: Record<string, any>[] = [];

      for (let i = 0; i < testRuns; i++) {
        console.log(`\nTest run ${i + 1} of ${testRuns}...`);
        const result = await dbReplicationService.syncAllFiles();
        results.push(result);

        // Wait a bit between runs to let the system stabilize
        if (i < testRuns - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      // Generate and display the report
      const report = this.generateReport(results);

      // Compare with previous report if requested
      if (compareWithPrevious && this.previousReports.length > 0) {
        const comparisonReport = this.compareWithPrevious(report);
        this.displayComparisonReport(comparisonReport);
      }

      // Display the current report
      this.displayReport(report);

      // Save the report to a file
      await this.saveReportToFile(report);

      // Store this report for future comparisons
      this.previousReports.push(report);

    } catch (error) {
      console.error('Performance test failed:', error);
      new Notice('❌ Performance test failed');
    }
  }

  /**
   * Clear the database
   */
  private async clearDatabase(): Promise<void> {
    try {
      const { db } = await import('../db');
      await db.clearAllData();
      console.log('Database cleared successfully');
    } catch (error) {
      console.error('Failed to clear database:', error);
      throw error;
    }
  }

  /**
   * Compare current report with previous report
   */
  private compareWithPrevious(currentReport: Record<string, any>): Record<string, any> {
    const previousReport = this.previousReports[this.previousReports.length - 1];

    const comparison: Record<string, any> = {
      current: currentReport,
      previous: previousReport,
      differences: {}
    };

    // Compare duration
    const durationDiff = currentReport.avgDuration - previousReport.avgDuration;
    const durationPercentage = (durationDiff / previousReport.avgDuration) * 100;
    comparison.differences.duration = {
      absolute: durationDiff,
      percentage: durationPercentage,
      improved: durationDiff < 0
    };

    // Compare metrics
    comparison.differences.metrics = {};

    for (const [key, value] of Object.entries(currentReport.metrics)) {
      if (previousReport.metrics[key] !== undefined) {
        const diff = (value as number) - previousReport.metrics[key];
        const percentage = (diff / previousReport.metrics[key]) * 100;

        comparison.differences.metrics[key] = {
          absolute: diff,
          percentage: percentage,
          improved: diff < 0
        };
      }
    }

    return comparison;
  }

  /**
   * Display comparison report
   */
  private displayComparisonReport(comparison: Record<string, any>): void {
    console.log('\n========== PERFORMANCE COMPARISON ==========');

    const { duration, metrics } = comparison.differences;

    // Format duration change
    const durationChange = duration.improved ?
      `${Math.abs(duration.percentage).toFixed(1)}% faster` :
      `${Math.abs(duration.percentage).toFixed(1)}% slower`;

    console.log(`Overall performance: ${durationChange} (${Math.abs(duration.absolute).toFixed(2)} seconds ${duration.improved ? 'saved' : 'added'})`);

    console.log('\nMetric changes:');
    for (const [key, data] of Object.entries(metrics)) {
      const metricData = data as { absolute: number, percentage: number, improved: boolean };
      const change = metricData.improved ?
        `${Math.abs(metricData.percentage).toFixed(1)}% faster` :
        `${Math.abs(metricData.percentage).toFixed(1)}% slower`;

      console.log(`- ${key}: ${change} (${Math.abs(metricData.absolute).toFixed(0)} ms ${metricData.improved ? 'saved' : 'added'})`);
    }

    console.log('===========================================');
  }

  /**
   * Generate a performance report from test results
   */
  private generateReport(results: Record<string, any>[]): Record<string, any> {
    // Calculate averages
    const totalFiles = results[0].totalFiles;
    const avgDuration = results.reduce((sum, result) => sum + result.totalDuration, 0) / results.length;
    const avgTimePerFile = results.reduce((sum, result) => sum + result.averageTimePerFile, 0) / results.length;

    // Calculate standard deviation for stability analysis
    const durationVariance = results.reduce((sum, result) => sum + Math.pow(result.totalDuration - avgDuration, 2), 0) / results.length;
    const durationStdDev = Math.sqrt(durationVariance);
    const stabilityScore = (1 - (durationStdDev / avgDuration)) * 100; // Higher is better

    // Aggregate metrics across all runs
    const aggregatedMetrics: Record<string, number> = {};
    results.forEach(result => {
      Object.entries(result.metrics).forEach(([key, value]) => {
        if (!aggregatedMetrics[key]) {
          aggregatedMetrics[key] = 0;
        }
        aggregatedMetrics[key] += (value as number) / results.length;
      });
    });

    // Calculate percentages
    const totalTime = Object.values(aggregatedMetrics).reduce((sum, time) => sum + time, 0);
    const percentages: Record<string, number> = {};
    Object.entries(aggregatedMetrics).forEach(([key, value]) => {
      percentages[key] = (value / totalTime) * 100;
    });

    // Sort metrics by time (descending)
    const sortedMetrics = Object.entries(aggregatedMetrics)
      .sort((a, b) => b[1] - a[1])
      .reduce((obj, [key, value]) => {
        obj[key] = value;
        return obj;
      }, {} as Record<string, number>);

    // Generate optimization recommendations
    const recommendations: string[] = [];

    // Analyze batch processing
    if (percentages['batchProcessing'] > 40) {
      recommendations.push('Consider increasing batch size for better throughput');
    }

    // Analyze database operations
    if (percentages['dbSave'] > 30) {
      recommendations.push('Database write operations are taking significant time. Consider using transactions or further optimizing batch sizes');
    }

    // Analyze file reading
    if (percentages['fileReading'] > 20) {
      recommendations.push('File reading is taking significant time. Consider implementing a file content cache for frequently accessed files');
    }

    // Analyze overall performance
    if (avgTimePerFile > 1) {
      recommendations.push('Overall processing time per file is high. Consider implementing incremental updates instead of full syncs');
    }

    return {
      totalFiles,
      avgDuration,
      avgTimePerFile,
      metrics: sortedMetrics,
      percentages,
      testRuns: results.length,
      timestamp: new Date().toISOString(),
      stability: {
        stdDev: durationStdDev,
        score: stabilityScore
      },
      recommendations
    };
  }

  /**
   * Display the performance report in the console
   */
  private displayReport(report: Record<string, any>): void {
    console.log('\n========== PERFORMANCE REPORT ==========');
    console.log(`Total files processed: ${report.totalFiles}`);
    console.log(`Average duration: ${report.avgDuration.toFixed(2)} seconds`);
    console.log(`Average time per file: ${report.avgTimePerFile.toFixed(2)} ms`);
    console.log(`Test runs: ${report.testRuns}`);
    console.log(`Stability score: ${report.stability.score.toFixed(1)}% (lower variation is better)`);

    console.log('\nPerformance breakdown:');

    Object.entries(report.metrics).forEach(([key, value]) => {
      const percentage = report.percentages[key].toFixed(1);
      console.log(`- ${key}: ${(value as number).toFixed(0)} ms (${percentage}%)`);
    });

    console.log('\nRecommendations:');

    if (report.recommendations.length > 0) {
      report.recommendations.forEach(recommendation => {
        console.log(`- ${recommendation}`);
      });
    } else {
      console.log('- No specific recommendations. Performance looks good!');
    }

    console.log('\nEstimated performance:');
    const filesPerSecond = report.totalFiles / report.avgDuration;
    console.log(`- Processing speed: ${filesPerSecond.toFixed(1)} files/second`);
    console.log(`- Estimated time for 10,000 files: ${(10000 / filesPerSecond).toFixed(1)} seconds`);

    console.log('=========================================');
  }

  /**
   * Save the performance report to a file
   */
  private async saveReportToFile(report: Record<string, any>): Promise<void> {
    try {
      const reportFolder = 'performance_reports';
      const fileName = `db_replication_${new Date().toISOString().replace(/:/g, '-')}.md`;

      // Create the report folder if it doesn't exist
      if (!this.app.vault.getAbstractFileByPath(reportFolder)) {
        await this.app.vault.createFolder(reportFolder);
      }

      // Generate the report content
      const content = [
        '# Database Replication Performance Report',
        `Generated: ${new Date().toLocaleString()}`,
        '',
        '## Summary',
        `- Total files processed: ${report.totalFiles}`,
        `- Average duration: ${report.avgDuration.toFixed(2)} seconds`,
        `- Average time per file: ${report.avgTimePerFile.toFixed(2)} ms`,
        `- Test runs: ${report.testRuns}`,
        `- Stability score: ${report.stability.score.toFixed(1)}%`,
        '',
        '## Performance Breakdown',
        ...Object.entries(report.metrics).map(([key, value]) => {
          const percentage = report.percentages[key].toFixed(1);
          return `- **${key}**: ${(value as number).toFixed(0)} ms (${percentage}%)`;
        }),
        '',
        '## Recommendations',
        ...(report.recommendations.length > 0
          ? report.recommendations.map(rec => `- ${rec}`)
          : ['- No specific recommendations. Performance looks good!']),
        '',
        '## Estimated Performance',
        `- Processing speed: ${(report.totalFiles / report.avgDuration).toFixed(1)} files/second`,
        `- Estimated time for 10,000 files: ${(10000 / (report.totalFiles / report.avgDuration)).toFixed(1)} seconds`,
      ].join('\n');

      // Save the report
      await this.app.vault.create(`${reportFolder}/${fileName}`, content);
      new Notice(`✅ Performance report saved to ${reportFolder}/${fileName}`);

    } catch (error) {
      console.error('Failed to save performance report:', error);
      new Notice('❌ Failed to save performance report');
    }
  }
} 