import { useQuery } from '@tanstack/react-query'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import api from '@/lib/api'
import { Package, FileText, Users, AlertTriangle } from 'lucide-react'

interface DashboardStats {
  totalEquipmentTypes: number
  totalEquipmentUnits: number
  activeRentals: number
  totalCustomers: number
  overdueRentals: number
  todaySchedule: Array<{
    id: string
    rentalNumber: string
    customerName: string
    type: string
    time: string
  }>
}

export default function DashboardPage() {
  const { data, isLoading } = useQuery<DashboardStats>({
    queryKey: ['dashboard'],
    queryFn: async () => {
      const res = await api.get('/dashboard/stats')
      return res.data
    },
  })

  if (isLoading) {
    return <div className="flex items-center justify-center py-12 text-muted-foreground">載入中...</div>
  }

  const stats = [
    { label: '器材類型', value: data?.totalEquipmentTypes ?? 0, icon: Package, color: 'text-blue-600' },
    { label: '器材總數', value: data?.totalEquipmentUnits ?? 0, icon: Package, color: 'text-green-600' },
    { label: '進行中租賃', value: data?.activeRentals ?? 0, icon: FileText, color: 'text-purple-600' },
    { label: '客戶數', value: data?.totalCustomers ?? 0, icon: Users, color: 'text-orange-600' },
  ]

  return (
    <div className="space-y-6">
      {/* Stats cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{stat.label}</CardTitle>
              <stat.icon className={`h-4 w-4 ${stat.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Overdue alert */}
      {(data?.overdueRentals ?? 0) > 0 && (
        <Card className="border-destructive">
          <CardHeader className="flex flex-row items-center gap-2 pb-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            <CardTitle className="text-sm text-destructive">逾期提醒</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm">目前有 <strong>{data?.overdueRentals}</strong> 筆租賃已逾期未歸還</p>
          </CardContent>
        </Card>
      )}

      {/* Today schedule */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">今日排程</CardTitle>
        </CardHeader>
        <CardContent>
          {data?.todaySchedule && data.todaySchedule.length > 0 ? (
            <div className="space-y-3">
              {data.todaySchedule.map((item) => (
                <div key={item.id} className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <p className="text-sm font-medium">{item.rentalNumber}</p>
                    <p className="text-xs text-muted-foreground">{item.customerName}</p>
                  </div>
                  <Badge variant={item.type === 'pickup' ? 'default' : 'secondary'}>
                    {item.type === 'pickup' ? '取件' : '歸還'}
                  </Badge>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">今日沒有排程</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
