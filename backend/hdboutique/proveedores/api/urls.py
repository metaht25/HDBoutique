from rest_framework.routers import DefaultRouter
from proveedores.api.views import (
    ProveedoresViewSet,
    OfreceViewSet,
    ProductoproveedorViewSet,
)

router = DefaultRouter()

router.register('proveedores', ProveedoresViewSet, basename='proveedores')
router.register('ofrece', OfreceViewSet, basename='ofrece')
router.register('productos-proveedores', ProductoproveedorViewSet, basename='productos-proveedores')

urlpatterns = router.urls