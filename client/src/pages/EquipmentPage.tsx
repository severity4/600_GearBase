import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import api from '@/lib/api'
import { Search, Plus } from 'lucide-react'

interface EquipmentType {
  id: string
  name: string
  category: string
  brand: string
  dailyRate: number
  totalUnits: number
  availableUnits: number
}

export default function EquipmentPage() {
  const [search, setSearch] = useState('')

  const { data: types, isLoading } = useQuery<EquipmentType[]>({
    queryKey: ['equipment-types', search],
    queryFn: async () => {
      const res = await api.get('/equipment-types', { params: search ? { search } : undefined })
      return res.data
    },
  })

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="搜尋器材..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button>
          <Plus className="h-4 w-4" />
          新增器材類型
        </Button>
      </div>

      {/* Equipment list */}
      {isLoading ? (
        <div className="py-12 text-center text-muted-foreground">載入中...</div>
      ) : !types?.length ? (
        <div className="py-12 text-center text-muted-foreground">沒有找到器材</div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {types.map((type) => (
            <Card key={type.id} className="cursor-pointer transition-shadow hover:shadow-md">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-base">{type.name}</CardTitle>
                    <p className="text-sm text-muted-foreground">{type.brand}</p>
                  </div>
                  <Badge variant="secondary">{type.category}</Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    可用 <strong className="text-foreground">{type.availableUnits}</strong> / {type.totalUnits}
                  </span>
                  <span className="font-medium">${type.dailyRate}/日</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
