import { Request, Response } from 'express'
import { ReportService } from './report.service'

const service = new ReportService()

export class ReportController {
  async exportTrips(req: Request, res: Response) {
    const { format = 'xlsx', from, to } = req.query as Record<string, string>
    if (format === 'csv') {
      await service.exportTripsCSV(res, { from, to })
    } else {
      await service.exportTripsExcel(res, { from, to })
    }
  }

  async getRevenue(req: Request, res: Response) {
    const { from, to } = req.query as Record<string, string>
    const data = await service.getRevenue({ from, to })
    res.json(data)
  }

  async getDriversReport(_req: Request, res: Response) {
    const data = await service.getDriversReport()
    res.json(data)
  }
}
