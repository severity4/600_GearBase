import { useQuery } from '@tanstack/react-query'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import api from '@/lib/api'
import { Plus } from 'lucide-react'

interface Rental {
  id: string
  rentalNumber: string
  status: string
  customerName: string
  startDate: string
  endDate: string
  totalAmount: number
}

const statusMap: Record<string, { label: string; variant: 'default' | 'secondary' | 'success' | 'warning' | 'destructive' }> = {
  draft: { label: '草稿', variant: 'secondary' },
  confirmed: { label: '已確認', variant: 'default' },
  active: { label: '進行中', variant: 'success' },
  returned: { label: '已歸還', variant: 'secondary' },
  completed: { label: '已完成', variant: 'success' },
  overdue: { label: '逾期', variant: 'destructive' },
  cancelled: { label: '已取消', variant: 'secondary' },
}

export default function RentalsPage() {
  const { data: rentals, isLoading } = useQuery<Rental[]>({
    queryKey: ['rentals'],
    queryFn: async () => {
      const res = await api.get('/rentals')
      return res.data
    },
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">共 {rentals?.length ?? 0} 筆租賃</p>
        <Button>
          <Plus className="h-4 w-4" />
          新增租賃
        </Button>
      </div>

      {isLoading ? (
        <div className="py-12 text-center text-muted-foreground">載入中...</div>
      ) : !rentals?.length ? (
        <div className="py-12 text-center text-muted-foreground">沒有租賃紀錄</div>
      ) : (
        <div className="space-y-3">
          {rentals.map((rental) => {
            const status = statusMap[rental.status] ?? { label: rental.status, variant: 'secondary' as const }
            return (
              <Card key={rental.id} className="cursor-pointer transition-shadow hover:shadow-md">
                <CardContent className="flex items-center justify-between p-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{rental.rentalNumber}</p>
                      <Badge variant={status.variant}>{status.label}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{rental.customerName}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(rental.startDate).toLocaleDateString('zh-TW')} ~ {new Date(rental.endDate).toLocaleDateString('zh-TW')}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">${rental.totalAmount?.toLocaleString()}</p>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
