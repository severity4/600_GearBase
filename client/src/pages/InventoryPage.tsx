import { useQuery } from '@tanstack/react-query'
import { Badge } from '@/components/ui/badge'
import api from '@/lib/api'

interface EquipmentUnit {
  id: string
  serialNumber: string
  equipmentTypeName: string
  status: string
  condition: string
  storageLocation: string
}

const statusColors: Record<string, 'default' | 'success' | 'warning' | 'destructive' | 'secondary'> = {
  available: 'success',
  rented: 'default',
  maintenance: 'warning',
  retired: 'secondary',
  damaged: 'destructive',
}

const statusLabels: Record<string, string> = {
  available: '可用',
  rented: '出租中',
  maintenance: '維修中',
  retired: '已報廢',
  damaged: '損壞',
}

export default function InventoryPage() {
  const { data: units, isLoading } = useQuery<EquipmentUnit[]>({
    queryKey: ['equipment-units'],
    queryFn: async () => {
      const res = await api.get('/equipment-units')
      return res.data
    },
  })

  if (isLoading) {
    return <div className="py-12 text-center text-muted-foreground">載入中...</div>
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">共 {units?.length ?? 0} 台設備</p>

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="px-4 py-3 text-left font-medium">序號</th>
              <th className="px-4 py-3 text-left font-medium">器材類型</th>
              <th className="px-4 py-3 text-left font-medium">狀態</th>
              <th className="px-4 py-3 text-left font-medium">狀況</th>
              <th className="px-4 py-3 text-left font-medium">存放位置</th>
            </tr>
          </thead>
          <tbody>
            {units?.map((unit) => (
              <tr key={unit.id} className="border-t hover:bg-muted/30 cursor-pointer">
                <td className="px-4 py-3 font-mono">{unit.serialNumber}</td>
                <td className="px-4 py-3">{unit.equipmentTypeName}</td>
                <td className="px-4 py-3">
                  <Badge variant={statusColors[unit.status] ?? 'secondary'}>
                    {statusLabels[unit.status] ?? unit.status}
                  </Badge>
                </td>
                <td className="px-4 py-3">{unit.condition}</td>
                <td className="px-4 py-3">{unit.storageLocation}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
